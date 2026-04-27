import os from "os";
import { initSentry, withSentry, Sentry } from "@nyx/shared";
import { isProd, machineRegion, machineId } from "../worker-id";

initSentry({
  tags: {
    machine_region: machineRegion,
    machine_id: machineId,
    machine_hostname: os.hostname(),
  },
  context: {
    name: "machine",
    data: {
      region: machineRegion,
      hostname: os.hostname(),
      pid: process.pid,
      arch: os.arch(),
      cpus: os.cpus().length,
      uptime: os.uptime(),
    },
  },
});

export { withSentry, Sentry };
