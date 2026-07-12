import { useCallback, useEffect, useState, type ReactNode } from "react";
import * as api from "./api";
import { IOSDevice } from "./ios";
import { AthleteApp } from "./apps/AthleteApp";
import { ParentApp } from "./apps/ParentApp";
import { CoachApp } from "./apps/CoachApp";
import { PersonaSwitcher } from "./kit/PersonaSwitcher";

// Inside the native app (Capacitor) the phone provides the real status bar and
// bezel, so the recovered device frame is web-only presentation chrome.
const IS_NATIVE = typeof window !== "undefined" && !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

// The app lives inside the exact recovered iOS device frame (status bar, bezel,
// home indicator) — the same presentation as the howie.ntangible.co demo. The
// 402×874 device scales to fit whatever screen it's on.
function DeviceShell({ children }: { children: ReactNode }) {
  const [dims, setDims] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setDims({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const scale = Math.min(1, (dims.w - 16) / 402, (dims.h - 16) / 874);
  if (IS_NATIVE)
    return (
      <div
        style={{
          width: "100vw", height: "100dvh", background: "#F7F6F3", overflow: "hidden",
          paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)",
          boxSizing: "border-box",
        }}
      >
        {children}
      </div>
    );
  return (
    <div
      style={{
        width: "100vw", height: "100dvh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "#E8E6E1", overflow: "hidden",
      }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: "center", flexShrink: 0 }}>
        <IOSDevice navBar={false}>{children}</IOSDevice>
      </div>
    </div>
  );
}

export function App() {
  const [session, setSession] = useState<api.Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Magic-link landing: /?token=... from the sign-in email.
      const magic = new URLSearchParams(window.location.search).get("token");
      if (magic) {
        window.history.replaceState({}, "", window.location.pathname);
        try {
          const s = await api.verify(magic);
          api.setToken(s.session_token);
          setSession(s);
          setLoading(false);
          return;
        } catch {
          // expired/invalid link — fall through to the normal boot path
        }
      }
      if (api.getToken()) {
        try {
          setSession(await api.me());
        } catch {
          api.setToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const signOut = useCallback(() => {
    api.setToken(null);
    setSession(null);
  }, []);

  if (loading)
    return <DeviceShell><div style={{ width: "100%", height: "100%", background: "#F7F6F3" }} /></DeviceShell>;

  // Unauthenticated → the athlete template's own portal-access screen (the
  // single sign-in for all personas; the session's persona picks the app).
  if (!session || session.persona === "athlete")
    return (
      <>
        <DeviceShell>
          <AthleteApp session={session} onSignedIn={setSession} signOut={signOut} />
        </DeviceShell>
        <PersonaSwitcher />
      </>
    );
  if (session.persona === "parent")
    return <><DeviceShell><ParentApp signOut={signOut} /></DeviceShell><PersonaSwitcher /></>;
  return <><DeviceShell><CoachApp signOut={signOut} /></DeviceShell><PersonaSwitcher /></>;
}
