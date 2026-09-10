import { z } from "zod";

// Enum-string-lijsten gespiegeld aan de Prisma-enums. We dupliceren ze hier
// als Zod-enums omdat we eindwaarden willen valideren op de HTTP-grens.
export const SubsidieStatusValues = [
	"CONCEPT",
	"ACTIEF",
	"GEARCHIVEERD",
	"GEARCHIVEERD_VERVANGEN",
	"VERLOPEN",
] as const;
export type SubsidieStatusValue = (typeof SubsidieStatusValues)[number];

export const SubsidieBronTypeValues = ["LOKALEREGELGEVING", "PDF", "OVERIG"] as const;
export type SubsidieBronTypeValue = (typeof SubsidieBronTypeValues)[number];

export const SubsidieDoelgroepClusterValues = [
	"PARTICULIER",
	"BEDRIJF",
	"MAATSCHAPPELIJK",
] as const;
export type SubsidieDoelgroepClusterValue = (typeof SubsidieDoelgroepClusterValues)[number];

export const SubsidieStatusSchema = z.enum(SubsidieStatusValues);
export const SubsidieBronTypeSchema = z.enum(SubsidieBronTypeValues);
export const SubsidieDoelgroepClusterSchema = z.enum(SubsidieDoelgroepClusterValues);

const moneySchema = z
	.union([z.number(), z.string()])
	.transform((v) => (typeof v === "number" ? v : Number(v)))
	.refine((v) => Number.isFinite(v) && v >= 0, { message: "Bedrag moet >= 0 zijn" });

/**
 * Eén staffel-item: een maxbedrag/plafond dat voor één specifieke doelgroep
 * binnen de regeling geldt. Gebruikt wanneer een regeling per doelgroep andere
 * bedragen kent (bv. particulier max 750, stichting hoger). Zie SubsidieRegeling.plafonds.
 */
export const SubsidiePlafondSchema = z.object({
	doelgroepCluster: SubsidieDoelgroepClusterSchema,
	doelgroepNaam: z.string().default(""),
	maxBedragAanvrager: moneySchema.nullable().optional(),
	totaalSubsidiePlafond: moneySchema.nullable().optional(),
	omschrijving: z.string().default(""),
});
export type SubsidiePlafondInput = z.infer<typeof SubsidiePlafondSchema>;

/**
 * Velden die een concept mag bevatten. Bijna alles is optioneel; alleen `naam`
 * en `doelgroepCluster` moeten al ingevuld zijn zodat de regeling vindbaar
 * blijft in de lijst en gefilterd kan worden.
 */
export const SubsidieRegelingConceptSchema = z.object({
	naam: z.string().min(1).max(255),
	doel: z.string().default(""),
	voorwaarden: z.string().default(""),
	aanvraagprocedure: z.string().default(""),
	bronUrl: z.string().default(""),
	bronType: SubsidieBronTypeSchema.default("LOKALEREGELGEVING"),
	doelgroepNaam: z.string().default(""),
	doelgroepCluster: SubsidieDoelgroepClusterSchema,
	vervaldatum: z.coerce.date().nullable().optional(),
	looptijdStart: z.coerce.date().nullable().optional(),
	looptijdEind: z.coerce.date().nullable().optional(),
	maxBedragAanvrager: moneySchema.nullable().optional(),
	totaalSubsidiePlafond: moneySchema.nullable().optional(),
	/** Optionele staffeling per doelgroep; leeg = één bedrag (zie velden hierboven). */
	plafonds: z.array(SubsidiePlafondSchema).optional(),
});
export type SubsidieRegelingConceptInput = z.infer<typeof SubsidieRegelingConceptSchema>;

export const SubsidieRegelingUpdateSchema = SubsidieRegelingConceptSchema.partial();
export type SubsidieRegelingUpdateInput = z.infer<typeof SubsidieRegelingUpdateSchema>;

/**
 * Verplichte velden voor publicatie.
 * Validatie blokkeert publiceren zolang deze velden ontbreken.
 * Vervaldatum is bewust géén onderdeel: er bestaan doorlopende regelingen
 * zonder einddatum.
 */
export const SubsidieRegelingPublishableSchema = z.object({
	naam: z.string().min(2),
	doel: z.string().min(10),
	voorwaarden: z.string().min(10),
	aanvraagprocedure: z.string().min(10),
	bronUrl: z.string().url(),
	doelgroepNaam: z.string().min(2),
	doelgroepCluster: SubsidieDoelgroepClusterSchema,
});

export const SubsidieRegelingListQuerySchema = z.object({
	status: SubsidieStatusSchema.optional(),
	/**
	 * Komma-gescheiden lijst van statussen voor multi-select filtering.
	 * Heeft voorrang op `status` (single) en `includeArchived` als hij gezet is.
	 */
	statuses: z
		.string()
		.optional()
		.transform((value) => {
			// `undefined` → param ontbreekt (geen expliciete keuze)
			// `""` → param aanwezig maar leeg (gebruiker heeft alles uitgevinkt)
			// Onderscheid is van belang: bij `[]` moet de repo geen resultaten
			// teruggeven, niet terugvallen op defaults.
			if (value === undefined) return undefined;
			return value
				.split(",")
				.map((s) => s.trim())
				.filter((s) => s.length > 0)
				.filter(
					(s): s is z.infer<typeof SubsidieStatusSchema> =>
						SubsidieStatusSchema.safeParse(s).success,
				);
		}),
	doelgroepCluster: SubsidieDoelgroepClusterSchema.optional(),
	search: z.string().optional(),
	sort: z.enum(["vervaldatum", "naam", "updatedAt"]).default("vervaldatum"),
	order: z.enum(["asc", "desc"]).default("asc"),
	includeArchived: z.coerce.boolean().default(false),
	take: z.coerce.number().int().positive().max(200).default(20),
	skip: z.coerce.number().int().nonnegative().default(0),
});
export type SubsidieRegelingListQuery = z.infer<typeof SubsidieRegelingListQuerySchema>;

export const SubsidieRegelingReplaceSchema = z.object({
	opvolgerId: z.string().uuid(),
});
