import { spawn } from "child_process";

export function run(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    const stderr: Buffer[] = [];
    
    proc.stderr.on("data", (chunk) => stderr.push(chunk));
    proc.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`ffmpeg exited with code ${code}: ${Buffer.concat(stderr).toString()}`))
    );
  });
}
