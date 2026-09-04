/**
 * Database Schema Types
 */

// Re-export types from Prisma generated client
export type {
	User as GdhGebruiker,
	Session as GdhSessie,
	Chat as GdhGesprek,
	Message as GdhBericht,
	Vote as GdhStem,
	Stream as GdhStream,
	DocumentSource as GdhDocumentBron,
	DocumentChunk as GdhKennisbankFragment,
	DocumentEmbedding as GdhEmbedding,
	CkanDataset as GdhDataportaalDataset,
	CkanRecord as GdhDataportaalRecord,
	MessageDeprecated,
	VoteDeprecated,
	ChatVisibility as GdhZichtbaarheid,
} from "@gdh-chatbot/api/prisma";


export type GdhWijk = {
	WIJKCODE: string;
	WIJKNAAM: string;
	GEMEENTECODE: string;
	STADSDEELCODE: string;
	polygon: Array<Array<{ lat: number; lng: number }>>;
};

export type GdhBuurt = {
	BUURTCODE: string;
	BUURTNAAM: string;
	WIJKCODE: string;
	GEMEENTECODE: string;
	polygon: Array<Array<{ lat: number; lng: number }>>;
};

export type GdhStadsdeel = {
	STADSDEELCODE: string;
	STADSDEELNAAM: string;
	polygon: Array<Array<{ lat: number; lng: number }>>;
};

export type GdhBoom = {
	BOOMNUMMER: string;
	SOORTNAAM_NL: string;
	SOORTNAAM_WET: string;
	BOOMHOOGTE: number | null;
	STAMDIAMETER: number | null;
	PLANTJAAR: number | null;
	EIGENAAR: string | null;
	BEHEERDER: string | null;
	RD_X: number;
	RD_Y: number;
	lat: number;
	lng: number;
	stadsdeel: string | null;
	wijk: string | null;
	buurt: string | null;
};

export type GdhStadslandbouwLocatie = {
	NAAM: string;
	TYPE: string;
	ADRES: string | null;
	OPPERVLAKTE: number | null;
	RD_X: number;
	RD_Y: number;
	lat: number;
	lng: number;
	stadsdeel: string | null;
	wijk: string | null;
	buurt: string | null;
};

export type GdhGroengebied = {
	NAAM: string;
	TYPE: string;
	OPPERVLAKTE: number | null;
	BEHEERDER: string | null;
	polygon: Array<Array<{ lat: number; lng: number }>>;
};

export type GdhEcozone = {
	NAAM: string;
	TYPE: string;
	ECOLOGISCHE_WAARDE: string | null;
	polygon: Array<Array<{ lat: number; lng: number }>>;
};
