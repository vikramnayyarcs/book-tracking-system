interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_FARO_COLLECTOR_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
