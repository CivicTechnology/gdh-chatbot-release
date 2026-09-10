import { OTP } from "otplib";
import QRCode from "qrcode";
import { decryptSecret, encryptSecret, randomToken, sha256Hex, timingSafeEqualHex } from "@/lib/crypto/secure.js";
import * as repo from "../auth.repository.js";

// OTP instance voor TOTP-strategie. epochTolerance: 30 (één periode = 30 s) is
// equivalent aan window:1 in de v12 authenticator API.
const otp = new OTP({ strategy: "totp" });

const ISSUER = "GDH Beheerportaal";
const BACKUP_CODE_COUNT = 8;

/** Start enrollment: genereert + bewaart (versleuteld) een secret, geeft QR terug. */
export async function startEnrollment(userId: string, email: string) {
	const secret = otp.generateSecret(); // base32
	await repo.setTotpSecret(userId, encryptSecret(secret));
	const otpauth = otp.generateURI({ issuer: ISSUER, label: email, secret });
	const qrDataUrl = await QRCode.toDataURL(otpauth);
	return { qrDataUrl };
}

/** Verifieert de eerste code, zet mfaEnabled en levert eenmalige backupcodes (plaintext, alleen nu). */
export async function verifyEnrollment(userId: string, code: string): Promise<string[]> {
	const user = await repo.findUserById(userId);
	if (!user?.totpSecret) throw new Error("MFA-enrollment niet gestart");
	if (user.mfaEnabled) throw new Error("MFA al ingeschakeld");
	const result = await otp.verify({ secret: decryptSecret(user.totpSecret), token: code, epochTolerance: 30 });
	if (!result.valid) {
		throw new Error("Ongeldige code");
	}
	const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, () => randomToken(6));
	await repo.enableMfa(userId, backupCodes.map(sha256Hex));
	// Leg de gebruikte timeStep vast zodat de enrollment-code niet meteen als
	// tweede factor te replayen is.
	if ("timeStep" in result) await repo.setLastTotpTimeStep(userId, result.timeStep);
	return backupCodes;
}

/** Tweede factor bij login: TOTP of (eenmalig) backupcode. */
export async function verifySecondFactor(userId: string, code: string): Promise<boolean> {
	const user = await repo.findUserById(userId);
	if (!user?.mfaEnabled || !user.totpSecret) return false;

	// Replay-hardening: afterTimeStep weigert een code waarvan de timeStep al
	// eerder is verbruikt (<=), zodat dezelfde code niet binnen zijn ±30s-venster
	// een tweede keer als tweede factor bruikbaar is.
	const result = await otp.verify({
		secret: decryptSecret(user.totpSecret),
		token: code,
		epochTolerance: 30,
		afterTimeStep: user.lastTotpTimeStep ?? undefined,
	});
	if (result.valid) {
		if ("timeStep" in result) await repo.setLastTotpTimeStep(userId, result.timeStep);
		return true;
	}

	// backupcode-pad: constant-time, eenmalig verbruik.
	const codeHash = sha256Hex(code);
	const idx = user.mfaBackupCodes.findIndex((h) => timingSafeEqualHex(h, codeHash));
	if (idx === -1) return false;
	const remaining = user.mfaBackupCodes.filter((_, i) => i !== idx);
	await repo.setBackupCodes(userId, remaining);
	return true;
}
