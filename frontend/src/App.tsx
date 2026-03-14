import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import LoginView from "./views/LoginView";
import SignupView from "./views/SignupView";
import ForgotPasswordView from "./views/ForgotPasswordView";
import ResetPasswordView from "./views/ResetPasswordView";
import ChatView from "./views/ChatView";
import ProfileSettingsView from "./views/ProfileSettingsView";
import { loadSession, persistSession } from "./utils/session";
import type { Session } from "./types";

function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession());

  useEffect(() => {
    persistSession(session);
  }, [session]);

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate replace to={session ? "/chat" : "/login"} />}
      />
      <Route
        path="/login"
        element={session ? <Navigate replace to="/chat" /> : <LoginView onSessionChange={setSession} />}
      />
      <Route
        path="/signup"
        element={session ? <Navigate replace to="/chat" /> : <SignupView onSessionChange={setSession} />}
      />
      <Route
        path="/forgot-password"
        element={session ? <Navigate replace to="/chat" /> : <ForgotPasswordView />}
      />
      <Route
        path="/reset-password"
        element={session ? <Navigate replace to="/chat" /> : <ResetPasswordView onSessionChange={setSession} />}
      />
      <Route
        path="/chat"
        element={session ? <ChatView session={session} onSessionChange={setSession} /> : <Navigate replace to="/login" />}
      />
      <Route
        path="/profile"
        element={session ? <ProfileSettingsView session={session} onSessionChange={setSession} /> : <Navigate replace to="/login" />}
      />
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  );
}

export default App;
