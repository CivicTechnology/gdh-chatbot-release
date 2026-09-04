export type GdhDatasetKolom = {
	naam: string;
	type: "string" | "number" | "integer" | "boolean" | "array" | "object" | "null";
	nullable: boolean;
	beschrijving?: string;
	enumWaarden?: string[];
};

export type GdhDatasetSchema = {
	datasetNaam: string;
	weergaveNaam: string;
	beschrijving: string;
	kolommen: GdhDatasetKolom[];
	primairVeld: string;
	geometrieType: "punt" | "lijn" | "polygoon" | "geen";
};

export const STADSDELEN_SCHEMA: GdhDatasetSchema = {
	datasetNaam: "stadsdelen",
	weergaveNaam: "Haagse Stadsdelen",
	beschrijving: "Indeling van Den Haag in stadsdelen met grenzen",
	primairVeld: "STADSDEELNAAM",
	geometrieType: "polygoon",
	kolommen: [
		{ naam: "STADSDEELCODE", type: "string", nullable: false },
		{ naam: "STADSDEELNAAM", type: "string", nullable: false },
		{ naam: "OPPERVLAKTE", type: "number", nullable: true },
		{ naam: "AANTALINWONERS", type: "integer", nullable: true },
	],
};

export const WIJKEN_SCHEMA: GdhDatasetSchema = {
	datasetNaam: "wijken",
	weergaveNaam: "Haagse Wijken",
	beschrijving: "Indeling van Den Haag in wijken met CBS-codes",
	primairVeld: "WIJKNAAM",
	geometrieType: "polygoon",
	kolommen: [
		{ naam: "WIJKCODE", type: "string", nullable: false },
		{ naam: "WIJKNAAM", type: "string", nullable: false },
		{ naam: "GEMEENTECODE", type: "string", nullable: false },
		{ naam: "STADSDEELCODE", type: "string", nullable: true },
		{ naam: "STADSDEELNAAM", type: "string", nullable: true },
		{ naam: "OPPERVLAKTE", type: "number", nullable: true },
	],
};

export const BUURTEN_SCHEMA: GdhDatasetSchema = {
	datasetNaam: "buurten",
	weergaveNaam: "Haagse Buurten",
	beschrijving: "Indeling van Den Haag in buurten met CBS-codes",
	primairVeld: "BUURTNAAM",
	geometrieType: "polygoon",
	kolommen: [
		{ naam: "BUURTCODE", type: "string", nullable: false },
		{ naam: "BUURTNAAM", type: "string", nullable: false },
		{ naam: "WIJKCODE", type: "string", nullable: false },
		{ naam: "WIJKNAAM", type: "string", nullable: true },
		{ naam: "GEMEENTECODE", type: "string", nullable: false },
		{ naam: "STADSDEELCODE", type: "string", nullable: true },
		{ naam: "OPPERVLAKTE", type: "number", nullable: true },
	],
};

export const BOMEN_SCHEMA: GdhDatasetSchema = {
	datasetNaam: "bomen-json",
	weergaveNaam: "Haags Bomenregister",
	beschrijving: "Alle geregistreerde bomen in de openbare ruimte van Den Haag",
	primairVeld: "BOOMNUMMER",
	geometrieType: "punt",
	kolommen: [
		{ naam: "BOOMNUMMER", type: "string", nullable: false },
		{ naam: "SOORTNAAM_NL", type: "string", nullable: true },
		{ naam: "SOORTNAAM_WET", type: "string", nullable: true },
		{ naam: "BOOMHOOGTE", type: "number", nullable: true },
		{ naam: "STAMDIAMETER", type: "integer", nullable: true },
		{ naam: "PLANTJAAR", type: "integer", nullable: true },
		{ naam: "EIGENAAR", type: "string", nullable: true },
		{ naam: "BEHEERDER", type: "string", nullable: true },
		{ naam: "BOOMTYPE", type: "string", nullable: true },
		{ naam: "RD_X", type: "number", nullable: false },
		{ naam: "RD_Y", type: "number", nullable: false },
		{ naam: "lat", type: "number", nullable: false },
		{ naam: "lng", type: "number", nullable: false },
		{ naam: "stadsdeel", type: "string", nullable: true },
		{ naam: "wijk", type: "string", nullable: true },
		{ naam: "buurt", type: "string", nullable: true },
	],
};

export const GROENGEBIEDEN_SCHEMA: GdhDatasetSchema = {
	datasetNaam: "sghgroengebieden",
	weergaveNaam: "Haagse Groengebieden",
	beschrijving: "Parken, plantsoenen en andere groengebieden in Den Haag",
	primairVeld: "NAAM",
	geometrieType: "polygoon",
	kolommen: [
		{ naam: "OBJECTID", type: "integer", nullable: false },
		{ naam: "NAAM", type: "string", nullable: true },
		{ naam: "TYPE", type: "string", nullable: true },
		{ naam: "OPPERVLAKTE", type: "number", nullable: true },
		{ naam: "BEHEERDER", type: "string", nullable: true },
		{ naam: "AANLEGJAAR", type: "integer", nullable: true },
	],
};

export const GROENVAKKEN_SCHEMA: GdhDatasetSchema = {
	datasetNaam: "groenvakken",
	weergaveNaam: "Haagse Groenvakken",
	beschrijving: "Beheervakken voor groenonderhoud in Den Haag",
	primairVeld: "VAKCODE",
	geometrieType: "polygoon",
	kolommen: [
		{ naam: "VAKCODE", type: "string", nullable: false },
		{ naam: "VAKNAAM", type: "string", nullable: true },
		{ naam: "BEHEERTYPE", type: "string", nullable: true },
		{ naam: "OPPERVLAKTE", type: "number", nullable: true },
	],
};

export const ECOZONES_SCHEMA: GdhDatasetSchema = {
	datasetNaam: "ecozones",
	weergaveNaam: "Haagse Ecozones",
	beschrijving: "Ecologische zones en natuurgebieden in Den Haag",
	primairVeld: "NAAM",
	geometrieType: "polygoon",
	kolommen: [
		{ naam: "OBJECTID", type: "integer", nullable: false },
		{ naam: "NAAM", type: "string", nullable: true },
		{ naam: "TYPE", type: "string", nullable: true },
		{ naam: "ECOLOGISCHE_WAARDE", type: "string", nullable: true },
		{ naam: "OPPERVLAKTE", type: "number", nullable: true },
	],
};

export const ECOBOMENRIJEN_SCHEMA: GdhDatasetSchema = {
	datasetNaam: "ecobomenrijen",
	weergaveNaam: "Haagse Ecologische Bomenrijen",
	beschrijving: "Bomenrijen met ecologische waarde in Den Haag",
	primairVeld: "OBJECTID",
	geometrieType: "lijn",
	kolommen: [
		{ naam: "OBJECTID", type: "integer", nullable: false },
		{ naam: "NAAM", type: "string", nullable: true },
		{ naam: "LENGTE", type: "number", nullable: true },
		{ naam: "BOOMSOORT", type: "string", nullable: true },
	],
};

export const FAUNAVOORZIENINGEN_SCHEMA: GdhDatasetSchema = {
	datasetNaam: "faunavoorzieningen",
	weergaveNaam: "Haagse Faunavoorzieningen",
	beschrijving: "Voorzieningen voor fauna zoals nestkasten en ecoducten",
	primairVeld: "OBJECTID",
	geometrieType: "punt",
	kolommen: [
		{ naam: "OBJECTID", type: "integer", nullable: false },
		{ naam: "TYPE", type: "string", nullable: true },
		{ naam: "DOELSOORT", type: "string", nullable: true },
		{ naam: "PLAATSINGSJAAR", type: "integer", nullable: true },
		{ naam: "RD_X", type: "number", nullable: true },
		{ naam: "RD_Y", type: "number", nullable: true },
		{ naam: "lat", type: "number", nullable: true },
		{ naam: "lng", type: "number", nullable: true },
	],
};

export const NATUURVRIENDELIJKE_OEVERS_SCHEMA: GdhDatasetSchema = {
	datasetNaam: "natuurvriendelijkeoevers",
	weergaveNaam: "Haagse Natuurvriendelijke Oevers",
	beschrijving: "Natuurvriendelijk ingerichte oevers langs Haagse watergangen",
	primairVeld: "OBJECTID",
	geometrieType: "lijn",
	kolommen: [
		{ naam: "OBJECTID", type: "integer", nullable: false },
		{ naam: "NAAM", type: "string", nullable: true },
		{ naam: "TYPE_OEVER", type: "string", nullable: true },
		{ naam: "LENGTE", type: "number", nullable: true },
		{ naam: "AANLEGJAAR", type: "integer", nullable: true },
	],
};

export const STADSLANDBOUW_SCHEMA: GdhDatasetSchema = {
	datasetNaam: "stadslandbouw",
	weergaveNaam: "Haagse Stadslandbouw Locaties",
	beschrijving: "Stadslandbouw initiatieven en locaties in Den Haag",
	primairVeld: "NAAM",
	geometrieType: "punt",
	kolommen: [
		{ naam: "OBJECTID", type: "integer", nullable: false },
		{ naam: "NAAM", type: "string", nullable: true },
		{ naam: "TYPE", type: "string", nullable: true, enumWaarden: [
			"Moestuin",
			"Voedselbos",
			"Volkstuincomplex",
			"Schooltuin",
			"Buurttuin",
			"Stadsboerderij",
			"Overig"
		]},
		{ naam: "ADRES", type: "string", nullable: true },
		{ naam: "OPPERVLAKTE", type: "number", nullable: true },
		{ naam: "WEBSITE", type: "string", nullable: true },
		{ naam: "CONTACTPERSOON", type: "string", nullable: true },
		{ naam: "RD_X", type: "number", nullable: true },
		{ naam: "RD_Y", type: "number", nullable: true },
		{ naam: "lat", type: "number", nullable: true },
		{ naam: "lng", type: "number", nullable: true },
		{ naam: "stadsdeel", type: "string", nullable: true },
		{ naam: "wijk", type: "string", nullable: true },
		{ naam: "buurt", type: "string", nullable: true },
	],
};

export const GDH_DATASET_SCHEMAS: Record<string, GdhDatasetSchema> = {
	stadsdelen: STADSDELEN_SCHEMA,
	wijken: WIJKEN_SCHEMA,
	buurten: BUURTEN_SCHEMA,
	"bomen-json": BOMEN_SCHEMA,
	sghgroengebieden: GROENGEBIEDEN_SCHEMA,
	groenvakken: GROENVAKKEN_SCHEMA,
	ecozones: ECOZONES_SCHEMA,
	ecobomenrijen: ECOBOMENRIJEN_SCHEMA,
	faunavoorzieningen: FAUNAVOORZIENINGEN_SCHEMA,
	natuurvriendelijkeoevers: NATUURVRIENDELIJKE_OEVERS_SCHEMA,
	stadslandbouw: STADSLANDBOUW_SCHEMA,
};

export function haalGdhDatasetSchemaOp(datasetNaam: string): GdhDatasetSchema | undefined {
	return GDH_DATASET_SCHEMAS[datasetNaam];
}

export function converteerNaarJsonSchema(schema: GdhDatasetSchema): Record<string, unknown> {
	const properties: Record<string, unknown> = {};
	const required: string[] = [];

	for (const kolom of schema.kolommen) {
		const prop: Record<string, unknown> = {};

		if (kolom.nullable) {
			prop.type = [kolom.type, "null"];
		} else {
			prop.type = kolom.type;
			required.push(kolom.naam);
		}

		if (kolom.beschrijving) {
			prop.description = kolom.beschrijving;
		}

		if (kolom.enumWaarden) {
			prop.enum = kolom.nullable ? [...kolom.enumWaarden, null] : kolom.enumWaarden;
		}

		properties[kolom.naam] = prop;
	}

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		title: schema.weergaveNaam,
		description: schema.beschrijving,
		type: "array",
		items: {
			type: "object",
			properties,
			required: required.sort(),
		},
	};
}

export const GDH_ONDERSTEUNDE_DATASETS = Object.keys(GDH_DATASET_SCHEMAS);

export const GDH_GEO_LOOKUP_DATASETS = ["wijken", "buurten", "stadsdelen"] as const;
