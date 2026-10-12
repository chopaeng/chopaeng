const env = import.meta.env;

/**
 * Maintenance / Under Construction flag
 * Controlled via UNDER_CONSTRUCTION=true or VITE_UNDER_CONSTRUCTION=true in environment variables
 */
export const IS_UNDER_CONSTRUCTION =
    String(env.UNDER_CONSTRUCTION ?? "").toLowerCase() === "true" ||
    String(env.VITE_UNDER_CONSTRUCTION ?? "").toLowerCase() === "true";

export const isUnderConstruction = IS_UNDER_CONSTRUCTION;

export * from "./api";
