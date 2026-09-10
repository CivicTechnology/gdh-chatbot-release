import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/auth/AuthProvider";
import { GuestRedirect } from "@/auth/GuestRedirect";
import { ThemeProvider } from "@/components/theme-provider";
import { LocalChatProvider } from "@/contexts/local-chat-context";
import AdminLayout from "@/pages/admin/AdminLayout";
import FeedbackPage from "@/pages/admin/FeedbackPage";
import SubsidieRegelingDetailPage from "@/pages/admin/SubsidieRegelingDetailPage";
import SubsidieRegelingenListPage from "@/pages/admin/SubsidieRegelingenListPage";
import ChatIdPage from "@/pages/ChatIdPage";
import ChatPage from "@/pages/ChatPage";
import LoginPage from "@/pages/LoginPage";

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
              {/* Samengevoegd: registratie en de losse beheerder-login bestaan
                  niet meer; alles loopt via het ene loginscherm op /login. */}
              <Route
                element={<Navigate replace to="/login" />}
                path="/register"
              />
              <Route
                element={<Navigate replace to="/login" />}
                path="/admin/login"
              />
              <Route element={<AdminLayout />} path="/admin">
                <Route element={<SubsidieRegelingenListPage />} index />
                <Route element={<FeedbackPage />} path="feedback" />
                <Route
                  element={<Navigate replace to="/admin" />}
                  path="subsidieregelingen"
                />
                <Route
                  element={<SubsidieRegelingDetailPage />}
                  path="subsidieregelingen/nieuw"
                />
                <Route
                  element={<SubsidieRegelingDetailPage />}
                  path="subsidieregelingen/:id"
                />
              </Route>
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
