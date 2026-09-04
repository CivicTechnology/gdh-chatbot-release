/**
 * Parser for Omgevingswet XML documents
 * Converts consolidated law XML into structured chunks for embedding
 */

import { ingestionConfig } from "@gdh-chatbot/shared";
import {
	type XmlNode,
	findChild,
	getAttribute,
	getChildrenByName,
	getTextContent,
	parseXml,
} from "../../lib/xml.js";

export type OmgevingswetChunkMetadata = {
	bwbId: string;
	preferredUrl: string;
	versionDate: string;
	chapterNumber?: string;
	chapterTitle?: string;
	sectionNumber?: string;
	sectionTitle?: string;
	subsectionNumber?: string;
	subsectionTitle?: string;
	titleNumber?: string;
	titleTitle?: string;
	articleNumber?: string;
	articleTitle?: string;
	articleLabel?: string;
	articleId?: string;
	articleAnchor?: string;
	paragraphNumber?: string;
	paragraphAnchor?: string;
	paragraphPart?: string;
};

export type OmgevingswetChunk = {
	text: string;
	tokenCount: number;
	metadata: OmgevingswetChunkMetadata;
	order: number;
};

type ParserOptions = {
	bwbId: string;
	preferredUrl: string;
	versionDate: string;
	maxTokensPerChunk?: number;
};

type ParserContext = {
	options: ParserOptions;
	chunks: OmgevingswetChunk[];
	currentChapter?: { number: string; title: string };
	currentSection?: { number: string; title: string };
	currentSubsection?: { number: string; title: string };
	currentTitle?: { number: string; title: string };
	order: number;
};

const WHITESPACE_REGEX = /\s+/g;
const DEFAULT_MAX_TOKENS = ingestionConfig.tokens.defaultMaxPerChunk;

function estimateTokens(text: string): number {
	if (!text) return 0;
	const trimmed = text.trim();
	if (!trimmed) return 0;
	const words = trimmed.split(WHITESPACE_REGEX).length;
	const chars = trimmed.length;
	return Math.max(1, Math.round(Math.max(words * 1.3, chars / 4)));
}

function normalizeWhitespace(text: string): string {
	return text.replace(WHITESPACE_REGEX, " ").trim();
}

function extractTextFromNode(node: XmlNode): string {
	const parts: string[] = [];

	for (const child of node.children) {
		if (typeof child === "string") {
			parts.push(child);
		} else if (child.tag === "al" || child.tag.endsWith(":al")) {
			parts.push(normalizeWhitespace(getTextContent(child)));
		} else if (child.tag === "lijst" || child.tag.endsWith(":lijst")) {
			parts.push(extractListText(child));
		} else if (child.tag === "table" || child.tag.endsWith(":table")) {
			parts.push(extractTableText(child));
		} else if (
			!child.tag.includes("meta") &&
			!child.tag.includes("jci") &&
			!child.tag.includes("link")
		) {
			parts.push(extractTextFromNode(child));
		}
	}

	return parts.filter(Boolean).join("\n");
}

function extractListText(node: XmlNode): string {
	const items: string[] = [];
	const listItems = getChildrenByName(node, "li");

	for (const li of listItems) {
		const liNr = findChild(li, "li.nr");
		const liBody = findChild(li, "li.body");

		const nr = liNr ? normalizeWhitespace(getTextContent(liNr)) : "";
		const body = liBody
			? normalizeWhitespace(extractTextFromNode(liBody))
			: normalizeWhitespace(extractTextFromNode(li));

		if (nr && body) {
			items.push(`${nr} ${body}`);
		} else if (body) {
			items.push(`- ${body}`);
		}
	}

	return items.join("\n");
}

function extractTableText(node: XmlNode): string {
	const rows: string[] = [];
	const tgroups = getChildrenByName(node, "tgroup");

	for (const tgroup of tgroups) {
		const tbody = findChild(tgroup, "tbody");
		if (!tbody) continue;

		for (const row of getChildrenByName(tbody, "row")) {
			const cells: string[] = [];
			for (const entry of getChildrenByName(row, "entry")) {
				cells.push(normalizeWhitespace(getTextContent(entry)));
			}
			if (cells.length > 0) {
				rows.push(cells.join(" | "));
			}
		}
	}

	return rows.join("\n");
}

function splitIntoChunks(text: string, maxTokens: number): string[] {
	const tokens = estimateTokens(text);
	if (tokens <= maxTokens) {
		return [text];
	}

	const sentences = text.split(/(?<=[.!?])\s+/);
	const chunks: string[] = [];
	let currentChunk = "";

	for (const sentence of sentences) {
		const potential = currentChunk ? `${currentChunk} ${sentence}` : sentence;

		if (estimateTokens(potential) <= maxTokens) {
			currentChunk = potential;
		} else {
			if (currentChunk) {
				chunks.push(currentChunk);
			}
			if (estimateTokens(sentence) > maxTokens) {
				const words = sentence.split(/\s+/);
				let wordChunk = "";
				for (const word of words) {
					const wordPotential = wordChunk ? `${wordChunk} ${word}` : word;
					if (estimateTokens(wordPotential) <= maxTokens) {
						wordChunk = wordPotential;
					} else {
						if (wordChunk) chunks.push(wordChunk);
						wordChunk = word;
					}
				}
				if (wordChunk) {
					currentChunk = wordChunk;
				}
			} else {
				currentChunk = sentence;
			}
		}
	}

	if (currentChunk) {
		chunks.push(currentChunk);
	}

	return chunks;
}

function createChunk(
	ctx: ParserContext,
	text: string,
	articleMeta?: {
		number?: string;
		title?: string;
		label?: string;
		id?: string;
		anchor?: string;
	},
	paragraphMeta?: {
		number?: string;
		anchor?: string;
		part?: string;
	},
): void {
	const trimmedText = text.trim();
	if (!trimmedText) return;

	const maxTokens = ctx.options.maxTokensPerChunk ?? DEFAULT_MAX_TOKENS;
	const textChunks = splitIntoChunks(trimmedText, maxTokens);

	for (const chunkText of textChunks) {
		const metadata: OmgevingswetChunkMetadata = {
			bwbId: ctx.options.bwbId,
			preferredUrl: ctx.options.preferredUrl,
			versionDate: ctx.options.versionDate,
		};

		if (ctx.currentChapter) {
			metadata.chapterNumber = ctx.currentChapter.number;
			metadata.chapterTitle = ctx.currentChapter.title;
		}
		if (ctx.currentSection) {
			metadata.sectionNumber = ctx.currentSection.number;
			metadata.sectionTitle = ctx.currentSection.title;
		}
		if (ctx.currentSubsection) {
			metadata.subsectionNumber = ctx.currentSubsection.number;
			metadata.subsectionTitle = ctx.currentSubsection.title;
		}
		if (ctx.currentTitle) {
			metadata.titleNumber = ctx.currentTitle.number;
			metadata.titleTitle = ctx.currentTitle.title;
		}
		if (articleMeta) {
			if (articleMeta.number) metadata.articleNumber = articleMeta.number;
			if (articleMeta.title) metadata.articleTitle = articleMeta.title;
			if (articleMeta.label) metadata.articleLabel = articleMeta.label;
			if (articleMeta.id) metadata.articleId = articleMeta.id;
			if (articleMeta.anchor) metadata.articleAnchor = articleMeta.anchor;
		}
		if (paragraphMeta) {
			if (paragraphMeta.number) metadata.paragraphNumber = paragraphMeta.number;
			if (paragraphMeta.anchor) metadata.paragraphAnchor = paragraphMeta.anchor;
			if (paragraphMeta.part) metadata.paragraphPart = paragraphMeta.part;
		}

		if (articleMeta?.anchor) {
			metadata.preferredUrl = `${ctx.options.preferredUrl}#${articleMeta.anchor}`;
		}

		ctx.chunks.push({
			text: chunkText,
			tokenCount: estimateTokens(chunkText),
			metadata,
			order: ctx.order++,
		});
	}
}

function parseArticle(ctx: ParserContext, article: XmlNode): void {
	const kop = findChild(article, "kop");
	const artikelNr = kop ? findChild(kop, "nr") : null;
	const artikelTitel = kop ? findChild(kop, "titel") : null;
	const artikelLabel = kop ? findChild(kop, "label") : null;

	const articleNumber = artikelNr
		? normalizeWhitespace(getTextContent(artikelNr))
		: undefined;
	const articleTitle = artikelTitel
		? normalizeWhitespace(getTextContent(artikelTitel))
		: undefined;
	const articleLabel = artikelLabel
		? normalizeWhitespace(getTextContent(artikelLabel))
		: undefined;

	const articleId = getAttribute(article, "id") ?? getAttribute(article, "bwb:id");
	const articleAnchor =
		articleId ?? (articleNumber ? `Artikel_${articleNumber}` : undefined);

	const articleMeta = {
		number: articleNumber,
		title: articleTitle,
		label: articleLabel,
		id: articleId,
		anchor: articleAnchor,
	};

	const lids = getChildrenByName(article, "lid");

	if (lids.length > 0) {
		for (const lid of lids) {
			const lidNr = findChild(lid, "lidnr");
			const paragraphNumber = lidNr
				? normalizeWhitespace(getTextContent(lidNr))
				: undefined;

			const lidId = getAttribute(lid, "id") ?? getAttribute(lid, "bwb:id");
			const paragraphAnchor =
				lidId ??
				(paragraphNumber && articleAnchor
					? `${articleAnchor}_lid_${paragraphNumber}`
					: undefined);

			const lidText = extractTextFromNode(lid);
			createChunk(ctx, lidText, articleMeta, {
				number: paragraphNumber,
				anchor: paragraphAnchor,
			});
		}
	} else {
		const articleText = extractTextFromNode(article);
		createChunk(ctx, articleText, articleMeta);
	}
}

function parseStructuralElement(
	ctx: ParserContext,
	node: XmlNode,
	level: "hoofdstuk" | "afdeling" | "paragraaf" | "titel",
): void {
	const kop = findChild(node, "kop");
	const nr = kop ? findChild(kop, "nr") : null;
	const titel = kop ? findChild(kop, "titel") : null;

	const number = nr ? normalizeWhitespace(getTextContent(nr)) : "";
	const title = titel ? normalizeWhitespace(getTextContent(titel)) : "";

	const structInfo = { number, title };

	switch (level) {
		case "hoofdstuk":
			ctx.currentChapter = structInfo;
			ctx.currentSection = undefined;
			ctx.currentSubsection = undefined;
			ctx.currentTitle = undefined;
			break;
		case "afdeling":
			ctx.currentSection = structInfo;
			ctx.currentSubsection = undefined;
			ctx.currentTitle = undefined;
			break;
		case "paragraaf":
			ctx.currentSubsection = structInfo;
			ctx.currentTitle = undefined;
			break;
		case "titel":
			ctx.currentTitle = structInfo;
			break;
	}

	for (const child of node.children) {
		if (typeof child === "string") continue;

		if (child.tag === "hoofdstuk" || child.tag.endsWith(":hoofdstuk")) {
			parseStructuralElement(ctx, child, "hoofdstuk");
		} else if (child.tag === "afdeling" || child.tag.endsWith(":afdeling")) {
			parseStructuralElement(ctx, child, "afdeling");
		} else if (child.tag === "paragraaf" || child.tag.endsWith(":paragraaf")) {
			parseStructuralElement(ctx, child, "paragraaf");
		} else if (child.tag === "titel" || child.tag.endsWith(":titel")) {
			parseStructuralElement(ctx, child, "titel");
		} else if (child.tag === "artikel" || child.tag.endsWith(":artikel")) {
			parseArticle(ctx, child);
		}
	}
}

function findWetBody(root: XmlNode): XmlNode | null {
	const toestand = root.tag === "toestand" ? root : findChild(root, "toestand");
	const wetgeving = findChild(toestand ?? root, "wetgeving");

	if (wetgeving) {
		const wetBesluit = findChild(wetgeving, "wet-besluit");
		if (wetBesluit) {
			const wettekst = findChild(wetBesluit, "wettekst");
			if (wettekst) return wettekst;
		}

		const wettekst = findChild(wetgeving, "wettekst");
		if (wettekst) return wettekst;
	}

	const wettekst = findChild(root, "wettekst");
	if (wettekst) return wettekst;

	return null;
}

export function parseOmgevingswet(
	xmlContent: string,
	options: ParserOptions,
): OmgevingswetChunk[] {
	const root = parseXml(xmlContent);
	const wetBody = findWetBody(root);

	if (!wetBody) {
		throw new Error("Could not find wet-body or wettekst element");
	}

	const ctx: ParserContext = {
		options,
		chunks: [],
		order: 0,
	};

	for (const child of wetBody.children) {
		if (typeof child === "string") continue;

		if (child.tag === "hoofdstuk" || child.tag.endsWith(":hoofdstuk")) {
			parseStructuralElement(ctx, child, "hoofdstuk");
		} else if (child.tag === "afdeling" || child.tag.endsWith(":afdeling")) {
			parseStructuralElement(ctx, child, "afdeling");
		} else if (child.tag === "paragraaf" || child.tag.endsWith(":paragraaf")) {
			parseStructuralElement(ctx, child, "paragraaf");
		} else if (child.tag === "titel" || child.tag.endsWith(":titel")) {
			parseStructuralElement(ctx, child, "titel");
		} else if (child.tag === "artikel" || child.tag.endsWith(":artikel")) {
			parseArticle(ctx, child);
		}
	}

	return ctx.chunks;
}

export function buildSectionPath(chunk: OmgevingswetChunk): string[] {
	const path: string[] = [];
	const meta = chunk.metadata;

	if (meta.chapterNumber) {
		path.push(
			`Hoofdstuk ${meta.chapterNumber}${meta.chapterTitle ? `: ${meta.chapterTitle}` : ""}`,
		);
	}
	if (meta.sectionNumber) {
		path.push(
			`Afdeling ${meta.sectionNumber}${meta.sectionTitle ? `: ${meta.sectionTitle}` : ""}`,
		);
	}
	if (meta.subsectionNumber) {
		path.push(
			`Paragraaf ${meta.subsectionNumber}${meta.subsectionTitle ? `: ${meta.subsectionTitle}` : ""}`,
		);
	}
	if (meta.articleNumber) {
		path.push(
			`Artikel ${meta.articleNumber}${meta.articleTitle ? `: ${meta.articleTitle}` : ""}`,
		);
	}
	if (meta.paragraphNumber) {
		path.push(`Lid ${meta.paragraphNumber}`);
	}

	return path;
}
