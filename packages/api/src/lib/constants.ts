// Re-export environment flags from shared config
export {
  isDevelopment as isDevelopmentEnvironment,
  isProduction as isProductionEnvironment,
  isTest as isTestEnvironment,
} from "@gdh-chatbot/shared";

// Environment-specific values (loaded from env vars at runtime)
export const ARC_GIS_STADSLANDBOUW_EMBED_URL =
  process.env.ARC_GIS_STADSLANDBOUW_EMBED_URL;

export const ARC_GIS_SOURCE_NAME = process.env.ARC_GIS_SOURCE_NAME;

/**
 * Doorverwijskanalen voor initiatiefnemers: niet naar 14070 of denhaag.nl,
 * wel naar PEP Den Haag en Haagse Stadmakers.
 * De bron van waarheid staat in packages/shared, omdat de
 * web-app dezelfde twee kanalen in de subsidie-widgets toont.
 */
export {
  DOORVERWIJZING,
  PEP_DEN_HAAG_URL,
} from "@gdh-chatbot/shared/doorverwijzing";
