const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const env = import.meta.env;

const DEFAULT_API_BASE = import.meta.env.PROD
    ? "https://dodo.chopaeng.com"
    : "http://localhost:8100";

export const API_BASE = trimTrailingSlash(
    env.VITE_API_BASE || DEFAULT_API_BASE
);

export const DODO_API_BASE = API_BASE;
export const ACNH_FINDER_API_BASE = API_BASE;
export const FINDER_API_BASE = API_BASE;
export const BLOGS_API_BASE = API_BASE;
export const CONSOLE_API_BASE = trimTrailingSlash(
    env.VITE_CONSOLE_API_BASE || "https://console.chopaeng.com"
);

