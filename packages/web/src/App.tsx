import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/auth/AuthProvider";
import { GuestRedirect } from "@/auth/GuestRedirect";
import { ThemeProvider } from "@/components/theme-provider";
import { LocalChatProvider } from "@/contexts/local-chat-context";
import ChatIdPage from "@/pages/ChatIdPage";
import ChatPage from "@/pages/ChatPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        disableTransitionOnChange
        enableSystem
      >
        <AuthProvider>
          <LocalChatProvider>
            <Toaster position="top-center" />
            <Routes>
              <Route element={<LoginPage />} path="/login" />
              <Route element={<RegisterPage />} path="/register" />
              <Route element={<GuestRedirect />}>
                <Route element={<ChatPage />} path="/" />
                <Route element={<ChatIdPage />} path="/chat/:id" />
              </Route>
              <Route element={<Navigate replace to="/" />} path="*" />
            </Routes>
          </LocalChatProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
