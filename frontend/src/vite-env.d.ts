/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FACTORY_ADDRESS?: string;
  readonly VITE_PM_ADDRESS?: string;
  readonly VITE_TREASURY_ADDRESS?: string;
  readonly VITE_USDC_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
