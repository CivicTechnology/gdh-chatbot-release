/**
 * Visibility Service
 * Business logic for chat visibility management
 */

import { chatApi } from "@/api/chat";
import type { VisibilityType } from "@/components/visibility-selector";

export async function updateChatVisibility(
  chatId: string,
  visibility: VisibilityType
): Promise<void> {
  await chatApi.updateVisibility(chatId, visibility);
}
