import assert from "node:assert/strict";
import { test } from "node:test";
import { aanvraagtermijn } from "./aanvraagtermijn.js";

const sluit = (iso: string | null) => ({
	aanvraagSluitingsdatum: iso ? new Date(iso) : null,
	aanvraagperiode: iso ? `uiterlijk ${iso}` : null,
});

test("open tot en met de sluitingsdatum, gesloten de dag erna", () => {
	assert.equal(aanvraagtermijn(sluit("2025-12-31"), new Date("2025-12-31T22:00:00Z")).aanvragenGesloten, false);
	// 23:30 UTC op 31 december is al 1 januari in Den Haag.
	assert.equal(aanvraagtermijn(sluit("2025-12-31"), new Date("2025-12-31T23:30:00Z")).aanvragenGesloten, true);
	assert.equal(aanvraagtermijn(sluit("2025-12-31"), new Date("2026-10-22T12:00:00Z")).aanvragenGesloten, true);
});

test("zonder sluitingsdatum is aanvragen nooit gesloten", () => {
	assert.equal(aanvraagtermijn(sluit(null), new Date("2030-01-01")).aanvragenGesloten, false);
});

test("geeft de datum als JJJJ-MM-DD terug, met de periode erbij", () => {
	assert.deepEqual(aanvraagtermijn(sluit("2025-12-31"), new Date("2026-01-01")), {
		aanvraagperiode: "uiterlijk 2025-12-31",
		aanvraagSluitingsdatum: "2025-12-31",
		aanvragenGesloten: true,
	});
});
