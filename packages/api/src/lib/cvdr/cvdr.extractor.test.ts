import assert from "node:assert/strict";
import { test } from "node:test";
import { betrouwbareSluitingsdatum } from "./cvdr.extractor.js";

test("houdt een sluitingsdatum zonder latere ronde", () => {
	assert.equal(betrouwbareSluitingsdatum("2025-12-31", "Uiterlijk 31 december 2025"), "2025-12-31");
});

test("laat een datum vallen als de periode een later jaar noemt", () => {
	assert.equal(
		betrouwbareSluitingsdatum(
			"2024-06-30",
			"a. voor 2024 van publicatie tot 30 juni 2024; b. voor 2025 en 2026 van 1 oktober tot 30 november",
		),
		null,
	);
});

test("zonder datum blijft het null", () => {
	assert.equal(betrouwbareSluitingsdatum(null, "jaarlijks van 1 februari tot en met 1 maart"), null);
});

test("laat een verzonnen jaar vallen als de periode geen jaartal noemt", () => {
	assert.equal(
		betrouwbareSluitingsdatum("2022-09-01", "Uiterlijk 1 september van het kalenderjaar waarop de aanvraag betrekking heeft"),
		null,
	);
	assert.equal(betrouwbareSluitingsdatum("2025-10-15", null), null);
});
