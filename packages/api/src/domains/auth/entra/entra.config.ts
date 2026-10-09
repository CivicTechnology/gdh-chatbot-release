import { readFileSync } from "node:fs";
import { ConfidentialClientApplication, LogLevel } from "@azure/msal-node";
import type { Configuration } from "@azure/msal-node";
import { config } from "@/config/index.js";

const e = config.entra;

/** SSO is alleen actief als tenant, client, redirect én een credential gezet zijn. */
export function isEntraConfigured(): boolean {
	const hasCredential = Boolean(
		e.clientSecret || (e.clientCertPath && e.clientCertThumbprint),
	);
	return Boolean(e.tenantId && e.clientId && e.redirectUri && hasCredential);
}

function buildConfiguration(): Configuration {
	const auth: Configuration["auth"] = {
		clientId: e.clientId as string,
		authority: `https://login.microsoftonline.com/${e.tenantId}`,
	};

	if (e.clientCertPath && e.clientCertThumbprint) {
		// Productie-voorkeur: certificaat boven secret (zie entra-setup.md).
		auth.clientCertificate = {
			thumbprintSha256: e.clientCertThumbprint,
			privateKey: readFileSync(e.clientCertPath, "utf8"),
		};
	} else {
		auth.clientSecret = e.clientSecret as string;
	}

	return {
		auth,
		system: {
			loggerOptions: {
				// logging-no-sensitive-data: geen PII loggen.
				loggerCallback: (_level, message) => console.log(`[msal] ${message}`),
				piiLoggingEnabled: false,
				logLevel: LogLevel.Warning,
			},
		},
	};
}

let cca: ConfidentialClientApplication | null = null;

/** Lazy singleton; pas instantiëren als SSO geconfigureerd is. */
export function getCca(): ConfidentialClientApplication {
	if (!isEntraConfigured()) {
		throw new Error("Entra ID is niet geconfigureerd");
	}
	if (!cca) {
		cca = new ConfidentialClientApplication(buildConfiguration());
	}
	return cca;
}

export const OIDC_SCOPES = ["openid", "profile", "email"];
