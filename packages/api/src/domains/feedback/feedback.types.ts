/** Richting van de beoordeling zoals de client die aanlevert. */
export type FeedbackRating = "up" | "down";

/** Input voor het upserten van feedback op een assistent-bericht. */
export type UpsertFeedbackInput = {
	chatId: string;
	messageId: string;
	rating: FeedbackRating;
	/** Optionele toelichting; `undefined` laat een bestaande toelichting staan. */
	comment?: string | null;
	/** Deel het volledige gesprek met beheerders; `undefined` laat de vlag staan. */
	chatShared?: boolean;
};

/** Filters + paginering voor de beheerderslijst. */
export type ListFeedbackQuery = {
	rating?: FeedbackRating;
	limit: number;
	offset: number;
};

/** Eén feedback-item zoals het beheerportaal het ontvangt. */
export type AdminFeedbackItem = {
	id: string;
	chatId: string;
	messageId: string;
	isUpvoted: boolean;
	comment: string | null;
	chatShared: boolean;
	createdAt: Date;
	updatedAt: Date;
	/** Vraag van de gebruiker die aan het beoordeelde antwoord voorafging. */
	prompt: string | null;
	/** Tekst van het beoordeelde assistent-antwoord. */
	response: string | null;
	/** Alleen gevuld wanneer de gebruiker het gesprek deelde (titel is afgeleid van de eerste vraag). */
	chatTitle: string | null;
};

/** Totalen voor de kop van de feedbackpagina. */
export type FeedbackStats = {
	total: number;
	upCount: number;
	downCount: number;
	withComment: number;
	sharedCount: number;
};

/** Eén bericht in de gedeelde-gesprek-weergave voor beheerders. */
export type SharedChatMessage = {
	id: string;
	role: string;
	text: string;
	createdAt: Date;
};

export type SharedChatOutput = {
	chat: {
		id: string;
		title: string;
		createdAt: Date;
	};
	messages: SharedChatMessage[];
};
