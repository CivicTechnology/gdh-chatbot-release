export type CvdrRegeling = {
	/** Werk-id zonder versie-suffix (bv. "CVDR230035"). Stabiel over versies. */
	werkId: string;
	/** Volledige versie-identifier (bv. "CVDR230035_1"). */
	versieId: string;
	versienummer: number;
	titel: string;
	creator: string;
	ratifier: string | null;
	subject: string | null;
	issuedDate: string | null;
	modifiedDate: string | null;
	inwerkingtredingDatum: string | null;
	uitwerkingtredingDatum: string | null;
	/** Wettelijke grondslag (dcterms.source), bv. "Algemene subsidieverordening Den Haag 2020". */
	grondslag: string | null;
	/** Link naar de grondslag-regeling op lokaleregelgeving.overheid.nl. */
	grondslagUrl: string | null;
	/** Kenmerk van de officiële bekendmaking (dcterms.isFormatOf), bv. "gmb-2023-298182". */
	bekendmakingKenmerk: string | null;
	/** Link naar de bekendmaking op zoek.officielebekendmakingen.nl. */
	bekendmakingUrl: string | null;
	/** Aard van deze versie (cvdripm betreft), bv. "nieuwe regeling" of "art. 3 gewijzigd". */
	betreft: string | null;
	/** Intern kenmerk van de gemeente, vaak een RIS-nummer (raadsinformatie). */
	kenmerk: string | null;
	/** Datum tot wanneer de regeling met terugwerkende kracht geldt. */
	terugwerkendekrachtDatum: string | null;
	/** Verwijzing naar externe bijlage(n) in de bron (exb-id's). */
	externeBijlage: string | null;
	/** CVDR-werk-id van de voorganger (bv. "CVDR600099"); meestal leeg. */
	opvolgerVan: string | null;
	xmlUrl: string;
	htmlUrl: string;
	workUrl: string;
};

export type CvdrCollectorOptions = {
	/** Aantal records per pagina (max 100 lijkt te werken op KOOP SRU). */
	pageSize?: number;
	/** Alleen records met dcterms.modified >= deze ISO-datum ophalen. */
	modifiedSince?: string;
	/** Override default gemeente-filter ("'s-Gravenhage"). */
	gemeente?: string;
	/** Override default titel-match ("subsidieregeling"). */
	titleTerm?: string;
};
