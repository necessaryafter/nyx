import { spawn } from "child_process";

// ffmpeg imprime progresso no stderr o tempo todo; se ficar calado esse tempo, travou.
const STALL_MS = 5 * 60_000;

export function run(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    // ffmpeg sem -nostats solta uma linha de progresso a cada frame — sem cortar,
    // um processo de vários minutos gera um erro de centenas de KB que já travou
    // o worker de log (pino-pretty roda em worker_thread e caiu tentando escrever
    // isso, derrubando o processo inteiro). Só guarda o final.
    let stderrTail = "";
    let stalled = false;

    let timer = setTimeout(onStall, STALL_MS);
    function onStall() {
      stalled = true;
      proc.kill("SIGKILL");
    }

    proc.stderr.on("data", (chunk) => {
      stderrTail = (stderrTail + chunk.toString()).slice(-2000);
      clearTimeout(timer);
      timer = setTimeout(onStall, STALL_MS);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) return resolve();
      reject(new Error(stalled
        ? `ffmpeg travou (sem progresso por ${STALL_MS / 60_000} min), processo morto: ${stderrTail}`
        : `ffmpeg exited with code ${code}: ${stderrTail}`));
    });
  });
}
