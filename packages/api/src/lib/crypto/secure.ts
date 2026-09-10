import crypto from "node:crypto";
import { config } from "@/config/index.js";

// Stabiele 32-byte sleutel afgeleid van AUTH_SECRET (min 32 chars, zod-gevalideerd).
// scrypt is bewust traag; daarom eenmalig bij module-load, niet per call.
const KEY = crypto.scryptSync(config.auth.secret, "gdh-entra-mfa-v1", 32);

const IV_BYTES = 12;
const TAG_BYTES = 16;

/** AES-256-GCM. Retourneert base64url(iv | authTag | ciphertext). */
export function encryptSecret(plaintext: string): string {
	const iv = crypto.randomBytes(IV_BYTES);
	const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
	const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([iv, tag, enc]).toString("base64url");
}

/** Keert encryptSecret om. Gooit als de authTag niet klopt (integriteit). */
export function decryptSecret(payload: string): string {
	const buf = Buffer.from(payload, "base64url");
	if (buf.length < IV_BYTES + TAG_BYTES) {
		throw new Error("Invalid encrypted payload");
	}
	const iv = buf.subarray(0, IV_BYTES);
	const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
	const enc = buf.subarray(IV_BYTES + TAG_BYTES);
	const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/** CSPRNG url-safe token. */
export function randomToken(bytes = 32): string {
	return crypto.randomBytes(bytes).toString("base64url");
}

/** SHA-256 hex digest (gebruikt voor hashen van backupcodes en state). */
export function sha256Hex(value: string): string {
	return crypto.createHash("sha256").update(value).digest("hex");
}

/** Constant-time vergelijking van twee hex-strings van gelijke lengte. */
export function timingSafeEqualHex(a: string, b: string): boolean {
	const ab = Buffer.from(a, "hex");
	const bb = Buffer.from(b, "hex");
	if (ab.length !== bb.length) return false;
	return crypto.timingSafeEqual(ab, bb);
}

/** Signed, geëncrypteerde, kortlevende payload (voor flow- en mfa-tokens). */
export function sealJson(obj: Record<string, unknown>, ttlMs: number): string {
	return encryptSecret(JSON.stringify({ ...obj, exp: Date.now() + ttlMs }));
}

/** Keert sealJson om; gooit als verlopen of als de authTag niet klopt. */
export function openJson<T = Record<string, unknown>>(sealed: string): T {
	const data = JSON.parse(decryptSecret(sealed)) as T & { exp: number };
	if (typeof data.exp !== "number" || data.exp < Date.now()) {
		throw new Error("Token expired");
	}
	return data;
}
