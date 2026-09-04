import { z } from "zod";

export const gdhDocumentBronSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1),
	url: z.string().url(),
	category: z.string().min(1),
	tags: z.array(z.string()),
	description: z.string().optional(),
	published_at: z.string().nullable().optional(),
	last_checked_at: z.string().nullable().optional(),
	notes: z.string().optional(),
});

export const sourceConfigSchema = gdhDocumentBronSchema;

export type GdhDocumentBronConfig = z.infer<typeof gdhDocumentBronSchema>;
export type SourceConfig = GdhDocumentBronConfig;

export const gdhDocumentBronArraySchema = z.array(gdhDocumentBronSchema);
export const sourceConfigArraySchema = gdhDocumentBronArraySchema;

export const gdhDataportaalConfigSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	description: z.string().optional(),
	enabled: z.boolean().default(true),
	filters: z
		.object({
			resourceFormats: z.array(z.string()).optional(),
			tags: z.array(z.string()).optional(),
		})
		.optional(),
});

export const ckanConfigSchema = gdhDataportaalConfigSchema;

export type GdhDataportaalConfig = z.infer<typeof gdhDataportaalConfigSchema>;
export type CkanConfig = GdhDataportaalConfig;

export const GDH_DOCUMENT_CATEGORIEEN = [
	"beleid/voedsel",
	"beleid/groen",
	"beleid/participatie",
	"beleid/duurzaamheid",
	"wetgeving/stadslandbouw",
	"wetgeving/omgeving",
	"raadsinformatie",
] as const;

export const GDH_DOCUMENT_TAGS = [
	"voedselstrategie",
	"stadslandbouw",
	"duurzaamheid",
	"groenbeleid",
	"participatie",
	"klimaatadaptatie",
	"biodiversiteit",
	"Den Haag",
] as const;

export function valideerGdhBronnen(data: unknown): GdhDocumentBronConfig[] {
	return gdhDocumentBronArraySchema.parse(data);
}

export const validateSources = valideerGdhBronnen;

export function valideerGdhBron(data: unknown): GdhDocumentBronConfig {
	return gdhDocumentBronSchema.parse(data);
}

export const validateSource = valideerGdhBron;
