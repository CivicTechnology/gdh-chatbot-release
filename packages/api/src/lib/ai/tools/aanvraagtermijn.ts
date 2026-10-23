/** Vandaag als JJJJ-MM-DD in Nederlandse tijd, zodat een termijn om middernacht hier sluit. */
function vandaagInDenHaag(now: Date): string {
	return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(now);
}

/**
 * Aanvraagtermijn zoals de tools hem aan het model en de widgets geven.
 * `aanvragenGesloten` is true zodra de sluitingsdatum uit de regelingstekst
 * voorbij is; de regeling zelf kan dan nog gewoon gelden.
 */
export function aanvraagtermijn(
	regeling: { aanvraagSluitingsdatum: Date | null; aanvraagperiode: string | null },
	now: Date = new Date(),
): {
	aanvraagperiode: string | null;
	aanvraagSluitingsdatum: string | null;
	aanvragenGesloten: boolean;
} {
	const sluiting = regeling.aanvraagSluitingsdatum?.toISOString().slice(0, 10) ?? null;
	return {
		aanvraagperiode: regeling.aanvraagperiode,
		aanvraagSluitingsdatum: sluiting,
		aanvragenGesloten: sluiting !== null && sluiting < vandaagInDenHaag(now),
	};
}
