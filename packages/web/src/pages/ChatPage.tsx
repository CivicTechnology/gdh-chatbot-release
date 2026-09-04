import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Chat } from "@/components/chat";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { generateUUID } from "@/lib/utils";

function ChatPageInner() {
  const [id] = useState(() => generateUUID());
  const [modelId, setModelId] = useState(DEFAULT_CHAT_MODEL);

  useEffect(() => {
    // Get the model from cookie if it exists
    const cookies = document.cookie.split(";");
    const chatModelCookie = cookies.find((cookie) =>
      cookie.trim().startsWith("chat-model=")
    );

    if (chatModelCookie) {
      const value = chatModelCookie.split("=")[1];
      if (value) {
        setModelId(value);
      }
    }
  }, []);

  return (
    <Chat
      autoResume={false}
      id={id}
      initialChatModel={modelId}
      initialMessages={[]}
      initialVisibilityType="private"
      isReadonly={false}
      key={id}
    />
  );
}

export default function ChatPage() {
  const location = useLocation();
  // Use navigation state key to force remount when clicking "new chat"
  const stateKey =
    (location.state as { key?: number } | null)?.key ?? "initial";

  return <ChatPageInner key={stateKey} />;
}
