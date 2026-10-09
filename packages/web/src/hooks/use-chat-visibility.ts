import useSWR, { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { getChatHistoryPaginationKey } from "@/components/sidebar-history";
import type { VisibilityType } from "@/lib/types";
import { updateChatVisibility } from "@/services/visibility.service";

export function useChatVisibility({
  chatId,
  initialVisibilityType,
}: {
  chatId: string;
  initialVisibilityType: VisibilityType;
}) {
  const { mutate } = useSWRConfig();

  const { data: localVisibility, mutate: setLocalVisibility } = useSWR(
    `${chatId}-visibility`,
    null,
    {
      fallbackData: initialVisibilityType,
    }
  );

  const visibilityType = localVisibility ?? "private";

  /**
   * Zet de zichtbaarheid om. De lokale waarde gaat vast vooruit zodat de UI
   * direct reageert, maar draait terug als de server de wijziging weigert.
   * De fout wordt doorgegooid zodat de aanroeper hem aan de gebruiker kan tonen.
   */
  const setVisibilityType = async (updatedVisibilityType: VisibilityType) => {
    const previousVisibilityType = visibilityType;

    setLocalVisibility(updatedVisibilityType);

    try {
      await updateChatVisibility(chatId, updatedVisibilityType);
    } catch (error) {
      setLocalVisibility(previousVisibilityType);
      throw error;
    }

    mutate(unstable_serialize(getChatHistoryPaginationKey));
  };

  return { visibilityType, setVisibilityType };
}
