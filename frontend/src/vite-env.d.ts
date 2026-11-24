/// <reference types="vite/client" />

/**
 * Public build-time environment. Everything here is bundled into the browser
 * output, so it must never contain a secret.
 */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_DEV_PROXY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
