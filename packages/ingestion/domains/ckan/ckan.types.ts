export type GdhDataportaalConfig = {
	description: string;
	apiBase: string;
	organization: string;
	datasets: {
		include: string[];
		exclude: string[];
	};
	notes?: string;
};

export type CkanConfig = GdhDataportaalConfig;

export type GdhDataportaalResource = {
	id: string;
	name: string;
	format: string;
	url: string;
	hash: string;
	size: number;
	last_modified: string;
};

export type CkanResource = GdhDataportaalResource;

export type GdhDataportaalPackage = {
	id: string;
	name: string;
	title: string;
	notes: string;
	resources: GdhDataportaalResource[];
};

export type CkanPackage = GdhDataportaalPackage;

export type GdhDatasetInfo = {
	packageId: string;
	naam: string;
	weergaveNaam: string;
	beschrijving: string;
	resourceUrl: string;
	contentHash: string;
	laatstGewijzigd: string;
	formaat: string;
};

export type DatasetInfo = {
	packageId: string;
	name: string;
	displayName: string;
	description: string;
	resourceUrl: string;
	contentHash: string;
	lastModified: string;
	format: string;
};

export type GdhSyncResultaat = {
	gesynchroniseerd: number;
	overgeslagen: number;
	fouten: number;
	totaal: number;
};

export type SyncResult = {
	synced: number;
	skipped: number;
	errors: number;
	total: number;
};

export type GdhBestaandeDataset = {
	id: string;
	naam: string;
	weergaveNaam: string;
	contentHash: string | null;
};

export type ExistingDataset = {
	id: string;
	name: string;
	displayName: string;
	contentHash: string | null;
};
