// Datasets used as geo-lookup layers to enrich point datasets with the
// stadsdeel/wijk/buurt they fall in. These are the gemeente Den Haag area
// divisions on the OpenDataSoft portal.
export const GDH_GEO_LOOKUP_DATASETS = ["wijken", "buurten", "stadsdelen"] as const;

// Property holding the human-readable area name per lookup layer.
// OpenDataSoft serves these fields lowercase (the old CKAN portal used UPPERCASE).
export const GDH_GEO_NAME_FIELD = {
	wijken: "wijknaam",
	buurten: "buurtnaam",
	stadsdelen: "stadsdeelnaam",
} as const;
