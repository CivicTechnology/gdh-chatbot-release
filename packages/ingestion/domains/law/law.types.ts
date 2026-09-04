/**
 * Law Domain Types
 */

export type LawSource = {
	id: string;
	title: string;
	category: string;
	tags: string[];
	description: string;
};

export type LawConfig = {
	description: string;
	sources: LawSource[];
};

export type SyncLawOptions = {
	force: boolean;
};

export type SyncLawResult = {
	imported: number;
	skipped: number;
	errors: number;
	total: number;
};

export type BwbRecordMetadata = {
	identifier: string;
	title: string;
	modified: string;
	preferredUrl: string;
	toestandUrl: string | null;
	manifestUrl: string | null;
	wtiUrl: string | null;
	items: Array<{
		type: string;
		url: string;
		label: string;
	}>;
};

export type BwbManifestVersion = {
	versionDate: string;
	itemPath: string;
	downloadUrl: string;
};

export type BwbManifest = {
	bwbId: string;
	versions: BwbManifestVersion[];
	latestVersion: BwbManifestVersion | null;
};
