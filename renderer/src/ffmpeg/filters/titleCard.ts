import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import { writeFile } from "fs/promises";
import { join } from "path";
import type { TitleCardPlan } from "../../compile/titleCard";

const FONT = '"Liberation Sans", "Noto Sans", Arial, sans-serif';

const C = {
  bg: "#0e1113",
  border: "rgba(255,255,255,0.10)",
  text: "#f5f7f8",
  muted: "#8a9399",
  orange: "#ff4500",
  button: "#1a282d",
  flairBg: "#3b2216",
  flairText: "#ff9a66",
  gold: "#f5c518",
};

export interface RenderedTitleCard {
  path: string;
  x: number;
  y: number;
  startSeconds: number;
  endSeconds: number;
}

/** Recorte quadrado central da imagem (o que "cover" faria num círculo): qualquer proporção vira o avatar sem distorcer. */
export function coverCrop(width: number, height: number): { sx: number; sy: number; size: number } {
  const size = Math.min(width, height);
  return { sx: Math.round((width - size) / 2), sy: Math.round((height - size) / 2), size };
}

/** Desenha o card (PNG com alpha) e devolve onde ele entra no vídeo. Medidas base: vídeo de 1080px de largura. */
export async function renderTitleCard(
  plan: TitleCardPlan,
  workDir: string,
  videoWidth: number,
  videoHeight: number,
): Promise<RenderedTitleCard> {
  const s = videoWidth / 1080;
  const px = (n: number) => Math.round(n * s);
  const cfg = plan.config;

  const subreddit = cfg.subreddit?.trim() || "r/historias";
  const username = cfg.username?.trim() || "";
  const timeAgo = cfg.timeAgo?.trim() || "há 5h";
  const flair = cfg.flair?.trim() || "";
  const upvotes = cfg.upvotes?.trim() || "18.4k";
  const comments = cfg.comments?.trim() || "1.2k";

  const W = px(920);
  const PAD = px(40);
  const AVATAR = px(68);
  const TITLE_SIZE = px(42);
  const LINE_H = px(54);
  const FOOTER_H = px(64);

  const measure = createCanvas(1, 1).getContext("2d");
  measure.font = `bold ${TITLE_SIZE}px ${FONT}`;
  const lines = wrap(measure, plan.title, W - PAD * 2, 6);

  const flairH = flair ? px(44) : 0;
  const H =
    PAD + AVATAR + px(26) + (flair ? flairH + px(24) : 0) + lines.length * LINE_H + px(30) + FOOTER_H + PAD;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Fundo
  roundRect(ctx, 1, 1, W - 2, H - 2, px(40));
  ctx.fillStyle = C.bg;
  ctx.fill();
  ctx.strokeStyle = C.border;
  ctx.lineWidth = px(2);
  ctx.stroke();

  // Cabeçalho: avatar + r/sub · tempo + u/usuário
  const avCx = PAD + AVATAR / 2;
  const avCy = PAD + AVATAR / 2;
  const avatar = plan.avatarPath ? await loadImage(plan.avatarPath).catch(() => undefined) : undefined; // imagem ruim: cai na letra
  if (avatar) {
    const { sx, sy, size } = coverCrop(avatar.width, avatar.height);
    ctx.save();
    ctx.beginPath();
    ctx.arc(avCx, avCy, AVATAR / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(avatar, sx, sy, size, size, avCx - AVATAR / 2, avCy - AVATAR / 2, AVATAR, AVATAR);
    ctx.restore();
  } else {
    ctx.fillStyle = C.orange;
    ctx.beginPath();
    ctx.arc(avCx, avCy, AVATAR / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${px(34)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((subreddit.replace(/^r\//i, "")[0] ?? "r").toUpperCase(), avCx, avCy + px(2));
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const textX = PAD + AVATAR + px(20);
  const nameY = username ? PAD + px(28) : PAD + px(44);
  ctx.font = `bold ${px(30)}px ${FONT}`;
  ctx.fillStyle = C.text;
  ctx.fillText(subreddit, textX, nameY);
  const nameW = ctx.measureText(subreddit).width;
  ctx.font = `${px(26)}px ${FONT}`;
  ctx.fillStyle = C.muted;
  ctx.fillText(` · ${timeAgo}`, textX + nameW, nameY);
  if (username) {
    ctx.font = `${px(24)}px ${FONT}`;
    ctx.fillText(username.startsWith("u/") ? username : `u/${username}`, textX, PAD + px(62));
  }

  // "···" e botão "+ Entrar"
  ctx.fillStyle = C.muted;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(W - PAD - px(36) + i * px(16), avCy, px(4), 0, Math.PI * 2);
    ctx.fill();
  }
  const btnW = px(150);
  const btnH = px(52);
  const btnX = W - PAD - px(64) - btnW;
  roundRect(ctx, btnX, avCy - btnH / 2, btnW, btnH, btnH / 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.fillStyle = C.bg;
  ctx.font = `bold ${px(26)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("+ Entrar", btnX + btnW / 2, avCy + px(1));
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  let y = PAD + AVATAR + px(26);

  // Flair
  if (flair) {
    ctx.font = `bold ${px(22)}px ${FONT}`;
    const label = flair.toUpperCase();
    const iconW = px(22);
    const pillW = px(16) + iconW + px(10) + ctx.measureText(label).width + px(18);
    roundRect(ctx, PAD, y, pillW, flairH, px(10));
    ctx.fillStyle = C.flairBg;
    ctx.fill();
    // ícone: documento
    ctx.strokeStyle = C.flairText;
    ctx.lineWidth = px(2.5);
    roundRect(ctx, PAD + px(16), y + (flairH - px(24)) / 2, iconW, px(24), px(4));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(PAD + px(21), y + flairH / 2 - px(3));
    ctx.lineTo(PAD + px(33), y + flairH / 2 - px(3));
    ctx.moveTo(PAD + px(21), y + flairH / 2 + px(4));
    ctx.lineTo(PAD + px(33), y + flairH / 2 + px(4));
    ctx.stroke();
    ctx.fillStyle = C.flairText;
    ctx.fillText(label, PAD + px(16) + iconW + px(10), y + flairH / 2 + px(8));
    y += flairH + px(24);
  }

  // Título
  ctx.fillStyle = C.text;
  ctx.font = `bold ${TITLE_SIZE}px ${FONT}`;
  for (const line of lines) {
    ctx.fillText(line, PAD, y + TITLE_SIZE);
    y += LINE_H;
  }
  y += px(30);

  // Rodapé: votos, comentários, compartilhar, prêmio
  let x = PAD;
  const pill = (w: number) => {
    roundRect(ctx, x, y, w, FOOTER_H, FOOTER_H / 2);
    ctx.fillStyle = C.button;
    ctx.fill();
  };
  const cy = y + FOOTER_H / 2;
  const gap = px(16);
  const setLabelFont = (size = 26) => {
    ctx.font = `bold ${px(size)}px ${FONT}`;
    ctx.fillStyle = C.text;
    ctx.textBaseline = "middle";
  };

  // votos
  setLabelFont();
  const votesW = px(22) + px(26) + px(14) + ctx.measureText(upvotes).width + px(14) + px(26) + px(22);
  pill(votesW);
  triangle(ctx, x + px(22) + px(13), cy, px(13), "up", C.orange, true, px(3));
  setLabelFont();
  ctx.fillText(upvotes, x + px(22) + px(26) + px(14), cy + px(1));
  triangle(ctx, x + votesW - px(22) - px(13), cy, px(13), "down", C.muted, false, px(3));
  x += votesW + gap;

  // comentários
  setLabelFont();
  const commW = px(22) + px(32) + px(12) + ctx.measureText(comments).width + px(24);
  pill(commW);
  bubble(ctx, x + px(22), cy - px(13), px(32), px(24), "#e6eaec", px(3));
  setLabelFont();
  ctx.fillText(comments, x + px(22) + px(32) + px(12), cy + px(1));
  x += commW + gap;

  // compartilhar
  setLabelFont(24);
  const shareLabel = "Compartilhar";
  const shareW = px(22) + px(24) + px(12) + ctx.measureText(shareLabel).width + px(24);
  pill(shareW);
  shareArrow(ctx, x + px(22), cy - px(12), px(24), "#e6eaec", px(3));
  setLabelFont(24);
  ctx.fillText(shareLabel, x + px(22) + px(24) + px(12), cy + px(1));
  x += shareW + gap;

  // prêmio
  roundRect(ctx, x, y, FOOTER_H, FOOTER_H, FOOTER_H / 2);
  ctx.fillStyle = C.button;
  ctx.fill();
  trophy(ctx, x + FOOTER_H / 2, cy, px(1), C.gold);

  const path = join(workDir, "title-card.png");
  await writeFile(path, canvas.toBuffer("image/png"));

  return {
    path,
    x: Math.round((videoWidth - W) / 2),
    // Um pouco abaixo do topo: a interface dos Shorts cobre os primeiros ~14%.
    y: Math.round(videoHeight * 0.18),
    startSeconds: plan.startSeconds,
    endSeconds: plan.endSeconds,
  };
}

function wrap(ctx: SKRSContext2D, text: string, maxW: number, maxLines: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && ctx.measureText(next).width > maxW) {
      lines.push(cur);
      cur = word;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1]!.replace(/\s*\S*$/, "") + "…";
    return kept;
  }
  return lines;
}

function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function triangle(ctx: SKRSContext2D, cx: number, cy: number, r: number, dir: "up" | "down", color: string, fill: boolean, lw: number) {
  const d = dir === "up" ? -1 : 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy + d * r);
  ctx.lineTo(cx + r, cy - d * r * 0.7);
  ctx.lineTo(cx - r, cy - d * r * 0.7);
  ctx.closePath();
  ctx.lineJoin = "round";
  if (fill) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

function bubble(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, color: string, lw: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineJoin = "round";
  roundRect(ctx, x, y, w, h, h / 3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.22, y + h);
  ctx.lineTo(x + w * 0.16, y + h + h * 0.3);
  ctx.lineTo(x + w * 0.42, y + h);
  ctx.stroke();
}

function shareArrow(ctx: SKRSContext2D, x: number, y: number, size: number, color: string, lw: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x, y + size);
  ctx.lineTo(x + size, y);
  ctx.moveTo(x + size * 0.3, y);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x + size, y + size * 0.7);
  ctx.stroke();
}

function trophy(ctx: SKRSContext2D, cx: number, cy: number, k: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - 12 * k, cy - 14 * k);
  ctx.lineTo(cx + 12 * k, cy - 14 * k);
  ctx.lineTo(cx + 8 * k, cy + 2 * k);
  ctx.lineTo(cx - 8 * k, cy + 2 * k);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(cx - 3 * k, cy + 2 * k, 6 * k, 8 * k);
  ctx.fillRect(cx - 10 * k, cy + 10 * k, 20 * k, 4 * k);
}
