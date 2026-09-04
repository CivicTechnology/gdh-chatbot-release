/// <reference types="vite/client" />

type ImportMetaEnv = {
  readonly VITE_API_URL?: string;
  // Add other env variables here as needed
};

type ImportMeta = {
  readonly env: ImportMetaEnv;
};
