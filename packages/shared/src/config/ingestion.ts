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
    // Elke batch wordt tot één raw SQL-string opgebouwd, dus houd 'm bescheiden:
    // 50k gaf een SQL-string van tientallen MB's per insert (geheugenpiek). 2,5k
    // houdt de piek klein zonder veel extra round-trips (149k bomen ≈ 60 inserts).
    batchSize: 2_500,
  },
  tokens: {
    defaultMaxPerChunk: 780,
  },
};
