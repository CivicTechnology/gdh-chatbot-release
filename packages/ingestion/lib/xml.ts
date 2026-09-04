/**
 * Lightweight XML parser for BWB legislation documents
 */

export type XmlNode = {
	tag: string;
	attributes: Record<string, string>;
	children: (XmlNode | string)[];
};

const ENTITY_MAP: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
};

function decodeEntities(text: string): string {
	return text.replace(/&([a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);/g, (match, entity) => {
		if (entity.startsWith("#x")) {
			return String.fromCharCode(Number.parseInt(entity.slice(2), 16));
		}
		if (entity.startsWith("#")) {
			return String.fromCharCode(Number.parseInt(entity.slice(1), 10));
		}
		return ENTITY_MAP[entity] ?? match;
	});
}

type Token =
	| { type: "open"; tag: string; attributes: Record<string, string> }
	| { type: "close"; tag: string }
	| { type: "self-closing"; tag: string; attributes: Record<string, string> }
	| { type: "text"; value: string }
	| { type: "cdata"; value: string };

function tokenize(xml: string): Token[] {
	const tokens: Token[] = [];
	let pos = 0;

	while (pos < xml.length) {
		if (xml.startsWith("<!--", pos)) {
			const end = xml.indexOf("-->", pos);
			if (end === -1) {
				throw new Error("Unclosed comment");
			}
			pos = end + 3;
			continue;
		}

		if (xml.startsWith("<![CDATA[", pos)) {
			const end = xml.indexOf("]]>", pos);
			if (end === -1) {
				throw new Error("Unclosed CDATA");
			}
			tokens.push({ type: "cdata", value: xml.slice(pos + 9, end) });
			pos = end + 3;
			continue;
		}

		if (xml.startsWith("<?", pos)) {
			const end = xml.indexOf("?>", pos);
			if (end === -1) {
				throw new Error("Unclosed processing instruction");
			}
			pos = end + 2;
			continue;
		}

		if (xml.startsWith("<!", pos)) {
			const end = xml.indexOf(">", pos);
			if (end === -1) {
				throw new Error("Unclosed declaration");
			}
			pos = end + 1;
			continue;
		}

		if (xml[pos] === "<") {
			const end = xml.indexOf(">", pos);
			if (end === -1) {
				throw new Error("Unclosed tag");
			}

			const tagContent = xml.slice(pos + 1, end);

			if (tagContent.startsWith("/")) {
				tokens.push({ type: "close", tag: tagContent.slice(1).trim() });
			} else if (tagContent.endsWith("/")) {
				const { tag, attributes } = parseTagContent(tagContent.slice(0, -1));
				tokens.push({ type: "self-closing", tag, attributes });
			} else {
				const { tag, attributes } = parseTagContent(tagContent);
				tokens.push({ type: "open", tag, attributes });
			}

			pos = end + 1;
			continue;
		}

		const nextTag = xml.indexOf("<", pos);
		const textEnd = nextTag === -1 ? xml.length : nextTag;
		const text = xml.slice(pos, textEnd);

		if (text.trim()) {
			tokens.push({ type: "text", value: decodeEntities(text) });
		}

		pos = textEnd;
	}

	return tokens;
}

function parseTagContent(content: string): {
	tag: string;
	attributes: Record<string, string>;
} {
	const trimmed = content.trim();
	const spaceIndex = trimmed.search(/\s/);

	if (spaceIndex === -1) {
		return { tag: trimmed, attributes: {} };
	}

	const tag = trimmed.slice(0, spaceIndex);
	const attrString = trimmed.slice(spaceIndex);
	const attributes: Record<string, string> = {};

	const attrRegex = /([^\s=]+)(?:=(?:"([^"]*)"|'([^']*)'))?/g;
	let match: RegExpExecArray | null;

	while ((match = attrRegex.exec(attrString)) !== null) {
		const [, name, doubleQuoted, singleQuoted] = match;
		attributes[name] = decodeEntities(doubleQuoted ?? singleQuoted ?? "");
	}

	return { tag, attributes };
}

export function parseXml(xml: string): XmlNode {
	const tokens = tokenize(xml);
	const stack: XmlNode[] = [];
	let root: XmlNode | null = null;

	for (const token of tokens) {
		if (token.type === "open") {
			const node: XmlNode = {
				tag: token.tag,
				attributes: token.attributes,
				children: [],
			};

			if (stack.length > 0) {
				stack[stack.length - 1].children.push(node);
			}

			stack.push(node);

			if (!root) {
				root = node;
			}
		} else if (token.type === "close") {
			if (stack.length === 0) {
				throw new Error(`Unexpected closing tag: ${token.tag}`);
			}

			const current = stack.pop();
			if (current && current.tag !== token.tag) {
				throw new Error(
					`Mismatched closing tag: expected ${current.tag}, got ${token.tag}`,
				);
			}
		} else if (token.type === "self-closing") {
			const node: XmlNode = {
				tag: token.tag,
				attributes: token.attributes,
				children: [],
			};

			if (stack.length > 0) {
				stack[stack.length - 1].children.push(node);
			} else if (!root) {
				root = node;
			}
		} else if (token.type === "text" || token.type === "cdata") {
			if (stack.length > 0) {
				stack[stack.length - 1].children.push(token.value);
			}
		}
	}

	if (!root) {
		throw new Error("No root element found");
	}

	return root;
}

export function getChildrenByName(node: XmlNode, name: string): XmlNode[] {
	return node.children.filter(
		(child): child is XmlNode =>
			typeof child !== "string" &&
			(child.tag === name || child.tag.endsWith(`:${name}`)),
	) as XmlNode[];
}

export function findChild(node: XmlNode, name: string): XmlNode | undefined {
	return getChildrenByName(node, name)[0];
}

export function getTextContent(node: XmlNode): string {
	let text = "";

	for (const child of node.children) {
		if (typeof child === "string") {
			text += child;
		} else {
			text += getTextContent(child);
		}
	}

	return text;
}

export function getAttribute(node: XmlNode, name: string): string | undefined {
	return node.attributes[name];
}
