import { Router } from "express";
import { requireAuth, requireBeheerder } from "@/domains/auth/auth.middleware.js";
import {
	archive,
	create,
	dashboard,
	destroy,
	history,
	index,
	publish,
	replaceBy,
	show,
	unarchive,
	update,
} from "./subsidieregeling.controller.js";

export const subsidieRegelingRouter = Router();

// Alle endpoints zijn afgeschermd: eerst een geldige sessie, daarna rolclaim
// "beheerder" (lokaal of via Entra ID).
subsidieRegelingRouter.use(requireAuth, requireBeheerder);

subsidieRegelingRouter.get("/dashboard", dashboard);
subsidieRegelingRouter.get("/", index);
subsidieRegelingRouter.post("/", create);
subsidieRegelingRouter.get("/:id", show);
subsidieRegelingRouter.patch("/:id", update);
subsidieRegelingRouter.delete("/:id", destroy);
subsidieRegelingRouter.post("/:id/publish", publish);
subsidieRegelingRouter.post("/:id/replace", replaceBy);
subsidieRegelingRouter.post("/:id/archive", archive);
subsidieRegelingRouter.post("/:id/unarchive", unarchive);
subsidieRegelingRouter.get("/:id/history", history);
