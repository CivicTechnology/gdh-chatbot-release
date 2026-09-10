import type { Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "@/domains/auth/auth.types.js";
import { ChatSDKError } from "@/lib/errors.js";
import * as service from "./subsidieregeling.service.js";
import {
	SubsidieRegelingConceptSchema,
	SubsidieRegelingListQuerySchema,
	SubsidieRegelingReplaceSchema,
	SubsidieRegelingUpdateSchema,
} from "./subsidieregeling.types.js";

function handleError(error: unknown, res: Response): void {
	if (error instanceof z.ZodError) {
		res.status(400).json({
			error: "bad_request",
			message: "Validatie mislukt",
			issues: error.issues,
		});
		return;
	}
	if (error instanceof ChatSDKError) {
		res.status(error.statusCode).json(error.toResponse());
		return;
	}
	console.error("Subsidieregeling controller error:", error);
	res.status(500).json({ error: "internal_error" });
}

export async function index(req: AuthenticatedRequest, res: Response): Promise<void> {
	try {
		const query = SubsidieRegelingListQuerySchema.parse(req.query);
		const result = await service.list(query);
		res.json(result);
	} catch (error) {
		handleError(error, res);
	}
}

export async function show(req: AuthenticatedRequest, res: Response): Promise<void> {
	try {
		const id = z.string().uuid().parse(req.params.id);
		const regeling = await service.getById(id);
		res.json(regeling);
	} catch (error) {
		handleError(error, res);
	}
}

export async function create(req: AuthenticatedRequest, res: Response): Promise<void> {
	try {
		const input = SubsidieRegelingConceptSchema.parse(req.body);
		const regeling = await service.createConcept(input, req.user?.id ?? null);
		res.status(201).json(regeling);
	} catch (error) {
		handleError(error, res);
	}
}

export async function update(req: AuthenticatedRequest, res: Response): Promise<void> {
	try {
		const id = z.string().uuid().parse(req.params.id);
		const input = SubsidieRegelingUpdateSchema.parse(req.body);
		const regeling = await service.updateRegeling(id, input, req.user?.id ?? null);
		res.json(regeling);
	} catch (error) {
		handleError(error, res);
	}
}

export async function destroy(req: AuthenticatedRequest, res: Response): Promise<void> {
	try {
		const id = z.string().uuid().parse(req.params.id);
		await service.deleteConcept(id);
		res.status(204).end();
	} catch (error) {
		handleError(error, res);
	}
}

const PublishBodySchema = z.object({
	vervangtId: z.string().uuid().optional(),
});

export async function publish(req: AuthenticatedRequest, res: Response): Promise<void> {
	try {
		const id = z.string().uuid().parse(req.params.id);
		const body = PublishBodySchema.parse(req.body ?? {});
		const regeling = await service.publishRegeling(
			id,
			req.user?.id ?? null,
			body.vervangtId,
		);
		res.json(regeling);
	} catch (error) {
		handleError(error, res);
	}
}

export async function replaceBy(req: AuthenticatedRequest, res: Response): Promise<void> {
	try {
		const id = z.string().uuid().parse(req.params.id);
		const { opvolgerId } = SubsidieRegelingReplaceSchema.parse(req.body);
		const regeling = await service.archiveAsReplacedBy(id, opvolgerId, req.user?.id ?? null);
		res.json(regeling);
	} catch (error) {
		handleError(error, res);
	}
}

export async function archive(req: AuthenticatedRequest, res: Response): Promise<void> {
	try {
		const id = z.string().uuid().parse(req.params.id);
		const regeling = await service.archiveRegeling(id, req.user?.id ?? null);
		res.json(regeling);
	} catch (error) {
		handleError(error, res);
	}
}

export async function unarchive(req: AuthenticatedRequest, res: Response): Promise<void> {
	try {
		const id = z.string().uuid().parse(req.params.id);
		const regeling = await service.unarchiveRegeling(id, req.user?.id ?? null);
		res.json(regeling);
	} catch (error) {
		handleError(error, res);
	}
}

export async function history(req: AuthenticatedRequest, res: Response): Promise<void> {
	try {
		const id = z.string().uuid().parse(req.params.id);
		const data = await service.getHistory(id);
		res.json(data);
	} catch (error) {
		handleError(error, res);
	}
}

export async function dashboard(_req: AuthenticatedRequest, res: Response): Promise<void> {
	try {
		const data = await service.getDashboard();
		res.json(data);
	} catch (error) {
		handleError(error, res);
	}
}
