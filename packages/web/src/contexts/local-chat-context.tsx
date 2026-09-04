import { createContext, useCallback, useContext, useState } from "react";
import {
  clearAllLocalChats as clearAllFromStorage,
  deleteLocalChat as deleteFromStorage,
  getLocalChats,
  type LocalChat,
  saveLocalChat as saveToStorage,
} from "@/lib/local-chat-storage";
import type { ChatMessage } from "@/lib/types";

type LocalChatContextType = {
  localChats: LocalChat[];
  refreshLocalChats: () => void;
  saveLocalChat: (id: string, title: string, messages: ChatMessage[]) => void;
  deleteLocalChat: (id: string) => void;
  clearAllLocalChats: () => void;
};

const LocalChatContext = createContext<LocalChatContextType | null>(null);

export function LocalChatProvider({ children }: { children: React.ReactNode }) {
  const [localChats, setLocalChats] = useState<LocalChat[]>(() =>
    getLocalChats()
  );

  const refreshLocalChats = useCallback(() => {
    setLocalChats(getLocalChats());
  }, []);

  const saveLocalChat = useCallback(
    (id: string, title: string, messages: ChatMessage[]) => {
      saveToStorage(id, title, messages);
      refreshLocalChats();
    },
    [refreshLocalChats]
  );

  const deleteLocalChat = useCallback(
    (id: string) => {
      deleteFromStorage(id);
      refreshLocalChats();
    },
    [refreshLocalChats]
  );

  const clearAllLocalChats = useCallback(() => {
    clearAllFromStorage();
    refreshLocalChats();
  }, [refreshLocalChats]);

  return (
    <LocalChatContext.Provider
      value={{
        localChats,
        refreshLocalChats,
        saveLocalChat,
        deleteLocalChat,
        clearAllLocalChats,
      }}
    >
      {children}
    </LocalChatContext.Provider>
  );
}

export function useLocalChats() {
  const context = useContext(LocalChatContext);
  if (!context) {
    throw new Error("useLocalChats must be used within a LocalChatProvider");
  }
  return context;
}
