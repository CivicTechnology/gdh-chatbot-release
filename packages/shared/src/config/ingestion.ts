/**
 * Data ingestion configuration
 * Settings for batch processing and data collection
 */

// ============================================================================
// Types
// ============================================================================

export type IngestionConfig = {
  ckan: {
    /** Number of concurrent dataset syncs (limited to avoid connection pool exhaustion) */
    concurrencyLimit: number;
  };
  database: {
    /** Number of records to insert per batch */
    batchSize: number;
  };
  tokens: {
    /** Default maximum tokens per chunk when parsing documents */
    defaultMaxPerChunk: number;
  };
};

// ============================================================================
// Configuration
// ============================================================================

export const ingestionConfig: IngestionConfig = {
  ckan: {
    concurrencyLimit: 3,
  },
  database: {
    batchSize: 50_000,
  },
  tokens: {
    defaultMaxPerChunk: 780,
  },
};
