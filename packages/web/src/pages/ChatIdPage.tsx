import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ChatData } from "@/api/chat";
import { useAuth } from "@/auth/useAuth";
import { Chat } from "@/components/chat";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import type { ChatMessage } from "@/lib/types";
import * as chatService from "@/services/chat.service";

export default function ChatIdPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAnonymous, isLoading: authLoading } = useAuth();

  const [chat, setChat] = useState<ChatData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [modelId, setModelId] = useState(DEFAULT_CHAT_MODEL);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;

    const loadChatData = async () => {
      if (!id) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      try {
        const result = await chatService.loadChat(id, {
          userId: user?.id,
          isAnonymous,
        });

        if (!result.success) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }

        setChat(result.chat);
        setMessages(result.messages);
        setModelId(result.modelId);
        setIsLoading(false);
      } catch (error) {
        console.error("Error loading chat:", error);
        setNotFound(true);
        setIsLoading(false);
      }
    };

    loadChatData();
  }, [id, user, isAnonymous, authLoading]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="text-muted-foreground">Laden...</div>
      </div>
    );
  }

  if (notFound || !chat) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4">
        <h1 className="font-semibold text-2xl">Chat niet gevonden</h1>
        <button
          className="text-primary hover:underline"
          onClick={() => navigate("/")}
          type="button"
        >
          Ga naar home
        </button>
      </div>
    );
  }

  const isReadonly = chatService.isReadonly(chat, user, isAnonymous);

  return (
    <Chat
      autoResume={!isAnonymous}
      id={chat.id}
      initialChatModel={modelId}
      initialLastContext={chat.lastContext ?? undefined}
      initialMessages={messages}
      initialVisibilityType={chat.visibility}
      isReadonly={isReadonly}
    />
  );
}
