export const isProd = process.env.ENVIRONMENT === "production"

export const machineRegion = isProd ?
    process.env.MACHINE_REGION ?? "vietnam" : 
    "brazil"

/**
 * ID único do worker, utilizado pelo Sentry para error tracking, uptime e etc.
 */
export const machineId = isProd ? 
    `renderer-${machineRegion}-${process.env.MACHINE_ID}` :
    `renderer-${machineRegion}-dev-0`