import { CryptoProvider, ResponseMode } from "@azure/msal-node";
import { config } from "@/config/index.js";
import { openJson, randomToken, sealJson, sha256Hex, timingSafeEqualHex } from "@/lib/crypto/secure.js";
import { createAuthSession } from "../auth.service.js";
import * as repo from "../auth.repository.js";
import { OIDC_SCOPES, getCca } from "./entra.config.js";

const cryptoProvider = new CryptoProvider();
const FLOW_TTL_MS = 10 * 60 * 1000;

// Canonieke INTERNE beheerder-rol die requireBeheerder en de frontend controleren.
// Losstaand van config.entra.beheerderRole, dat de EXTERNE Entra app-role-claimwaarde is.
const BEHEERDER_ROLE = "beheerder";

// Relevante claims uit het ID-token (subset).
interface EntraIdTokenClaims {
	oid?: string;
	tid?: string;
	nonce?: string;
	roles?: string[];
	email?: string;
	preferred_username?: string;
}

/** Bouwt de auth-code-URL en de te bewaren (verzegelde) flow-state. */
export async function beginLogin(): Promise<{ url: string; sealedFlow: string }> {
	const { verifier, challenge } = await cryptoProvider.generatePkceCodes();
	const state = randomToken(16);
	const nonce = randomToken(16);

	const url = await getCca().getAuthCodeUrl({
		scopes: OIDC_SCOPES,
		redirectUri: config.entra.redirectUri as string,
		responseMode: ResponseMode.QUERY, // QUERY i.v.m. sameSite=lax flow-cookie (geen FORM_POST)
		codeChallenge: challenge,
		codeChallengeMethod: "S256",
		state,
		nonce,
	});

	const sealedFlow = sealJson({ stateHash: sha256Hex(state), verifier, nonce }, FLOW_TTL_MS);
	return { url, sealedFlow };
}

export type CallbackResult =
	| { ok: true; sessionToken: string; sessionMaxAgeMs: number }
	| { ok: false; reason: "state" | "no_role" | "wrong_tenant" | "invalid" };

/**
 * Wisselt de code in, valideert state/nonce/tenant/rol en geeft een sessie-token terug.
 * Fail-closed: elke afwijking → { ok:false }.
 */
export async function completeLogin(params: {
	code: string;
	state: string;
	sealedFlow: string | undefined;
}): Promise<CallbackResult> {
	if (!params.sealedFlow || !params.code || !params.state) {
		return { ok: false, reason: "state" };
	}

	let flow: { stateHash: string; verifier: string; nonce: string };
	try {
		flow = openJson(params.sealedFlow);
	} catch {
		return { ok: false, reason: "state" };
	}

	if (!timingSafeEqualHex(flow.stateHash, sha256Hex(params.state))) {
		return { ok: false, reason: "state" };
	}

	let claims: EntraIdTokenClaims;
	try {
		const result = await getCca().acquireTokenByCode({
			code: params.code,
			scopes: OIDC_SCOPES,
			redirectUri: config.entra.redirectUri as string,
			codeVerifier: flow.verifier,
		});
		claims = (result.idTokenClaims ?? {}) as EntraIdTokenClaims;
	} catch (err) {
		console.error("[entra] token exchange failed:", (err as Error).message);
		return { ok: false, reason: "invalid" };
	}

	if (!claims.nonce || claims.nonce !== flow.nonce) {
		return { ok: false, reason: "invalid" };
	}
	if (!claims.tid || claims.tid !== config.entra.tenantId) {
		return { ok: false, reason: "wrong_tenant" };
	}
	const roles = Array.isArray(claims.roles) ? claims.roles : [];
	if (!roles.includes(config.entra.beheerderRole)) {
		return { ok: false, reason: "no_role" };
	}

	const oid = claims.oid;
	const email = (claims.preferred_username || claims.email || "").toLowerCase();
	if (!oid || !email) {
		return { ok: false, reason: "invalid" };
	}

	// Account-koppeling. De tenant-check hierboven (tid === geconfigureerde tenant) is de
	// beveiliging voor het koppelen op e-mail: alleen identiteiten uit de eigen tenant
	// bereiken dit punt, dus preferred_username/email wordt hier vertrouwd.
	let user = await repo.findUserByEntraOid(oid);
	if (!user) {
		const byEmail = await repo.findUserByEmail(email);
		user = byEmail
			? await repo.linkEntraOid(byEmail.id, oid, BEHEERDER_ROLE)
			: await repo.createEntraUser({ email, entraOid: oid, role: BEHEERDER_ROLE });
	} else if (user.role !== BEHEERDER_ROLE) {
		user = await repo.setUserRole(user.id, BEHEERDER_ROLE);
	}

	const sessionMaxAgeMs = config.entra.sessionMaxAgeMs;
	const sessionToken = await createAuthSession(user.id, sessionMaxAgeMs);
	return { ok: true, sessionToken, sessionMaxAgeMs };
}

/** Logout-URL bij Entra (post-logout redirect). */
export function buildLogoutUrl(): string {
	const base = `https://login.microsoftonline.com/${config.entra.tenantId}/oauth2/v2.0/logout`;
	const post = config.entra.postLogoutRedirectUri;
	return post ? `${base}?post_logout_redirect_uri=${encodeURIComponent(post)}` : base;
}
