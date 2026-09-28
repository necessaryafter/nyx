import { randomUUID } from "crypto";
import { PassThrough } from "stream";
import { createReadStream } from "fs";
import { mkdir, writeFile, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { storageClient as minio } from "@nyx/shared";

/**
 * Upload de arquivo grande em pedaços (start → N chunks → complete), extraído
 * de routes/assets.ts pra ser reaproveitado também pelo asset-import (o
 * vídeo bruto que o usuário sobe pra cortar usa o mesmo mecanismo). Guarda
 * os chunks em disco local até o complete, que streama tudo direto pro
 * MinIO — nunca monta o arquivo inteiro em memória.
 */

const UPLOAD_TMP = join(tmpdir(), "nyx-uploads");

export class ChunkedUploadError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function startChunkedUpload<M extends object>(
  meta: M & { userId: string },
): Promise<string> {
  const uploadId = randomUUID();
  await mkdir(join(UPLOAD_TMP, uploadId), { recursive: true });
  await writeFile(join(UPLOAD_TMP, uploadId, "meta.json"), JSON.stringify(meta));
  return uploadId;
}

async function readUploadMeta<M extends object>(
  uploadId: string,
  userId: string,
): Promise<M & { userId: string }> {
  let meta: M & { userId: string };
  try {
    meta = JSON.parse(await readFile(join(UPLOAD_TMP, uploadId, "meta.json"), "utf8"));
  } catch {
    throw new ChunkedUploadError(404, "upload not found");
  }
  if (meta.userId !== userId) throw new ChunkedUploadError(403, "forbidden");
  return meta;
}

export async function writeUploadChunk(uploadId: string, userId: string, index: number, data: Buffer): Promise<void> {
  await readUploadMeta(uploadId, userId); // valida que o upload existe e é do dono certo
  await writeFile(join(UPLOAD_TMP, uploadId, `${index}.chunk`), data);
}

/**
 * Junta os chunks e streama pro MinIO. `storageKey` recebe os metadados
 * salvos no start() pra poder montar a key com o nome real do arquivo (só
 * se sabe o nome depois de ler o meta.json, por isso é uma função e não um
 * valor fixo). Devolve os metadados também, pro chamador usar de novo (ex.
 * inserir a linha no banco).
 */
export async function completeChunkedUpload<M extends object>(
  uploadId: string,
  userId: string,
  totalChunks: number,
  totalSize: number,
  bucket: string,
  storageKey: (meta: M & { userId: string }) => string,
): Promise<{ meta: M & { userId: string }; storageKey: string }> {
  const meta = await readUploadMeta<M>(uploadId, userId);
  const key = storageKey(meta);
  const chunkDir = join(UPLOAD_TMP, uploadId);

  const pass = new PassThrough();
  const pipeChunks = async () => {
    for (let i = 0; i < totalChunks; i++) {
      await new Promise<void>((resolve, reject) => {
        const rs = createReadStream(join(chunkDir, `${i}.chunk`));
        rs.on("error", reject);
        rs.on("end", resolve);
        rs.pipe(pass, { end: false });
      });
    }
    pass.end();
  };
  pipeChunks().catch((err) => pass.destroy(err));

  await minio.putObject(bucket, key, pass, totalSize);
  await rm(chunkDir, { recursive: true, force: true });

  return { meta, storageKey: key };
}
