import useSWR, { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { getChatHistoryPaginationKey } from "@/components/sidebar-history";
import type { VisibilityType } from "@/components/visibility-selector";
import * as visibilityService from "@/services/visibility.service";

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

  const setVisibilityType = async (updatedVisibilityType: VisibilityType) => {
    setLocalVisibility(updatedVisibilityType);
    await visibilityService.updateChatVisibility(chatId, updatedVisibilityType);
    mutate(unstable_serialize(getChatHistoryPaginationKey));
  };

  return { visibilityType, setVisibilityType };
}
