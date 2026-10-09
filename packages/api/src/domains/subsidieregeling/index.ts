export { subsidieRegelingRouter } from "./subsidieregeling.routes.js";

// Service exports
export {
	getById,
	list,
	createConcept,
	updateRegeling,
	publishRegeling,
	archiveAsReplacedBy,
	markExpired,
	recordDeadLinkCheck,
	getHistory,
	getDashboard,
} from "./subsidieregeling.service.js";

// Repository exports (cron-jobs gebruiken deze direct)
export {
	findExpiredActive,
	findActiveForLinkCheck,
} from "./subsidieregeling.repository.js";

// Type exports
export {
	SubsidieStatusValues,
	SubsidieBronTypeValues,
	SubsidieDoelgroepClusterValues,
} from "./subsidieregeling.types.js";

export type {
	SubsidieStatusValue,
	SubsidieBronTypeValue,
	SubsidieDoelgroepClusterValue,
	SubsidieRegelingConceptInput,
	SubsidieRegelingUpdateInput,
	SubsidieRegelingListQuery,
} from "./subsidieregeling.types.js";
