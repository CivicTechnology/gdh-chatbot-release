import { Router } from "express";
import type { Request, Response } from "express";
import { isProduction } from "@gdh-chatbot/shared";
import { config } from "@/config/index.js";
import { setSessionCookie } from "../auth.middleware.js";
import { isEntraConfigured } from "./entra.config.js";
import { beginLogin, buildLogoutUrl, completeLogin } from "./entra.service.js";

const FLOW_COOKIE = "entra_flow";
const FLOW_COOKIE_PATH = "/api/auth/entra";

function flowCookieOptions() {
	return {
		httpOnly: true,
		secure: isProduction,
		sameSite: "lax" as const, // lax → werkt met QUERY-callback (top-level GET)
		maxAge: 10 * 60 * 1000,
		path: FLOW_COOKIE_PATH,
	};
}

export const entraRouter = Router();

entraRouter.get("/login", async (_req: Request, res: Response) => {
	if (!isEntraConfigured()) {
		res.status(404).json({ message: "SSO niet beschikbaar" });
		return;
	}
	try {
		const { url, sealedFlow } = await beginLogin();
		res.cookie(FLOW_COOKIE, sealedFlow, flowCookieOptions());
		res.redirect(url);
	} catch (error) {
		console.error("Entra login error");
		res.redirect(`${config.frontend.url}/login?error=sso`);
	}
});

entraRouter.get("/callback", async (req: Request, res: Response) => {
	// fail-closed: bij elke afwijking terug naar login met generieke fout.
	// De try/catch is essentieel: een onverwachte throw in een async handler
	// wordt door Express 4 niet opgevangen en legt als unhandled rejection
	// het hele proces om.
	try {
		const result = await completeLogin({
			code: String(req.query.code ?? ""),
			state: String(req.query.state ?? ""),
			sealedFlow: req.cookies?.[FLOW_COOKIE],
		});
		res.clearCookie(FLOW_COOKIE, { path: FLOW_COOKIE_PATH });

		if (!result.ok) {
			const code = result.reason === "no_role" ? "geen_toegang" : "sso";
			res.redirect(`${config.frontend.url}/login?error=${code}`);
			return;
		}

		setSessionCookie(res, result.sessionToken, result.sessionMaxAgeMs);
		// access-open-redirect: vaste interne bestemming.
		res.redirect(`${config.frontend.url}/admin`);
	} catch (error) {
		console.error("Entra callback error:", error);
		res.clearCookie(FLOW_COOKIE, { path: FLOW_COOKIE_PATH });
		res.redirect(`${config.frontend.url}/login?error=sso`);
	}
});

entraRouter.get("/logout", (req: Request, res: Response) => {
	res.clearCookie("session_token", { path: "/" });
	if (isEntraConfigured()) {
		res.redirect(buildLogoutUrl());
		return;
	}
	res.redirect(`${config.frontend.url}/login`);
});
