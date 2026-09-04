// Re-export environment flags from shared config
export {
  isProduction as isProductionEnvironment,
  isDevelopment as isDevelopmentEnvironment,
  isTest as isTestEnvironment,
} from "@gdh-chatbot/shared";

// Environment-specific values (loaded from env vars at runtime)
export const ARC_GIS_STADSLANDBOUW_EMBED_URL =
  process.env.ARC_GIS_STADSLANDBOUW_EMBED_URL;

export const ARC_GIS_SOURCE_NAME = process.env.ARC_GIS_SOURCE_NAME;
