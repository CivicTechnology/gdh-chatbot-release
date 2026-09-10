/**
 * Events die de CVDR-sync uitstuurt. De CLI consumeert ze naar stdout-progress;
 * de SSE-endpoint stuurt ze rechtstreeks naar de browser. Zelfde events =
 * zelfde semantiek = één bron van waarheid.
 *
 * Eén `regeling-progress`-event per verwerkte regeling: extract + upsert
 * gebeuren binnen dezelfde worker, dus alle uitkomsten (created / updated /
 * skipped / failed) staan in dit ene event.
 */
export type CvdrSyncMode = "update" | "reprocess";

export type CvdrSyncEvent =
	| {
			type: "start";
			today: string;
			modifiedSince?: string;
			mode: CvdrSyncMode;
	  }
	| { type: "fetched"; versies: number; werken: number }
	| {
			type: "regeling-progress";
			werkId: string;
			titel: string;
			/** DB-id van de geüpserte (of bestaande, bij skipped) SubsidieRegeling. */
			dbId?: string;
			done: number;
			total: number;
			outcome: "created" | "updated" | "skipped" | "failed";
			status?: "CONCEPT" | "VERLOPEN" | "ACTIEF";
			error?: string;
	  }
	| { type: "vervangen-resolved"; resolved: number; missingTarget: number }
	| { type: "cancelling" }
	| {
			type: "complete";
			stats: {
				versies: number;
				werken: number;
				created: number;
				updated: number;
				skipped: number;
				failed: number;
				vervangenResolved: number;
				totalMs: number;
			};
	  }
	| { type: "fatal"; message: string };
