/**
 * Visibility Service
 * Business logic for chat visibility management
 */

import { chatApi } from "@/api/chat";
import type { VisibilityType } from "@/lib/types";

const HTTP_STATUS = {
  networkError: 0,
  ok: 200,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
} as const;

/** Melding per HTTP-status, in het Nederlands en op taalniveau B1. */
const MESSAGE_BY_STATUS: Record<number, string> = {
  [HTTP_STATUS.networkError]:
    "Er is geen verbinding. Controleer uw internet en probeer het opnieuw.",
  [HTTP_STATUS.unauthorized]:
    "U bent niet meer ingelogd. Log opnieuw in en probeer het nog een keer.",
  // Deze meldingen dekken beide richtingen: een deel-link aanmaken en het delen
  // weer stoppen. Vermijd daarom "u kunt dit niet delen".
  [HTTP_STATUS.forbidden]:
    "Dit gesprek is niet van u. U kunt het delen daarom niet aanpassen.",
  [HTTP_STATUS.notFound]:
    "Dit gesprek is nog niet opgeslagen. Stel eerst een vraag. Daarna kunt u het delen.",
};

// Dekt bewust beide richtingen (deel-link aanmaken en delen stoppen) zonder het
// woord "zichtbaarheid", dat nergens in de deel-dialog staat.
const DEFAULT_MESSAGE =
  "Er ging iets mis met het delen van dit gesprek. Probeer het later opnieuw.";

/**
 * Fout bij het aanpassen van de zichtbaarheid van een gesprek.
 * De `message` is een tekst die u direct aan de gebruiker kunt tonen.
 */
export class VisibilityUpdateError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(MESSAGE_BY_STATUS[status] ?? DEFAULT_MESSAGE);
    this.name = "VisibilityUpdateError";
    this.status = status;
  }
}

export async function updateChatVisibility(
  chatId: string,
  visibility: VisibilityType
): Promise<void> {
  const response = await chatApi.updateVisibility(chatId, visibility);

  // De apiClient gooit niet: een 403/404 komt terug als `error` op de response.
  // Zonder deze controle lijkt een mislukte update geslaagd.
  if (response.error) {
    throw new VisibilityUpdateError(response.status);
  }
}

/**
 * Een gesprek kan pas gedeeld worden als het op de server staat.
 * Een nieuw gesprek waarin nog niets is gevraagd, bestaat daar nog niet.
 */
export async function isChatSaved(chatId: string): Promise<boolean> {
  const { status } = await chatApi.getChatById(chatId);
  // Alleen een echte 200 telt als "bestaat". Een netwerkfout (status 0) of een
  // serverfout zegt niets over het bestaan van het gesprek; die mogen niet als
  // bevestiging doorgaan, want dan zet de deel-knop zich onterecht open.
  return status === HTTP_STATUS.ok;
}
