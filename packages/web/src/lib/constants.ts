export const isProductionEnvironment = import.meta.env.PROD;
export const isDevelopmentEnvironment = import.meta.env.DEV;
export const isTestEnvironment = Boolean(
  import.meta.env.VITE_PLAYWRIGHT_TEST_BASE_URL ||
    import.meta.env.VITE_PLAYWRIGHT ||
    import.meta.env.VITE_CI_PLAYWRIGHT
);

export const ARC_GIS_STADSLANDBOUW_EMBED_URL = import.meta.env
  .VITE_ARC_GIS_STADSLANDBOUW_EMBED_URL;

export const ARC_GIS_SOURCE_NAME = import.meta.env.VITE_ARC_GIS_SOURCE_NAME;
