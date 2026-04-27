import { spawn } from "child_process";

export function probeDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    proc.stdout.on("data", (chunk) => stdout.push(chunk));
    proc.stderr.on("data", (chunk) => stderr.push(chunk));

    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`ffprobe exited with code ${code}: ${Buffer.concat(stderr).toString()}`));
      }

      const duration = parseFloat(Buffer.concat(stdout).toString().trim());
      if (Number.isNaN(duration)) {
        return reject(new Error(`ffprobe returned invalid duration for ${filePath}`));
      }

      resolve(duration);
    });
  });
}
