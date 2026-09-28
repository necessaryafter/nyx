import { spawn } from "child_process";

export function run(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    const stderr: Buffer[] = [];
    
    proc.stderr.on("data", (chunk) => stderr.push(chunk));
    proc.on("close", (code) =>
      code === 0
        ? resolve()
        // ffmpeg sem -nostats solta uma linha de progresso a cada frame — sem cortar,
        // um processo de vários minutos gera um erro de centenas de KB que já travou
        // o worker de log (pino-pretty roda em worker_thread e caiu tentando escrever
        // isso, derrubando o processo inteiro). Mesmo corte que scene-detection/detect.ts já usa.
        : reject(new Error(`ffmpeg exited with code ${code}: ${Buffer.concat(stderr).toString().slice(-2000)}`))
    );
  });
}
