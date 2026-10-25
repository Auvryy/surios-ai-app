import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { AppState, Platform } from "react-native";
import { useSession } from "@/auth/session-provider";
import { parseNotifications } from "@/lib/notifications";

const NotificationContext = createContext<{ unreadCount: number | null; syncCount: (count: number) => void; refreshBadge: () => void } | null>(null);
const foreground = () => AppState.currentState !== "background" && AppState.currentState !== "inactive" &&
  !(Platform.OS === "web" && typeof document !== "undefined" && document.visibilityState === "hidden");

export function NotificationProvider({ children }: PropsWithChildren) {
  const { session, status, request } = useSession();
  const token = session?.user.accountStatus === "ACTIVE" && status !== "loading" && status !== "unavailable" ? session.accessToken : undefined;
  const current = useRef<string | undefined>(undefined);
  const [count, setCount] = useState<{ owner?: string; value: number | null }>({ value: null });
  const sequence = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const syncCount = useCallback((value: number) => {
    if (!mounted.current || !token || current.current !== token) return;
    sequence.current++; pending.current?.abort(); pending.current = null;
    setCount({ owner: token, value });
  }, [token]);
  const refreshBadge = useCallback(() => {
    if (!token || current.current !== token || !foreground() || pending.current) return;
    const controller = new AbortController(); pending.current = controller;
    const version = ++sequence.current;
    void request("/api/notifications?limit=1", { signal: controller.signal }).then((data) => {
      const result = parseNotifications(data);
      if (mounted.current && !controller.signal.aborted && version === sequence.current && current.current === token)
        setCount({ owner: token, value: result.unreadCount });
    }).catch(() => {
      // Inbox has explicit errors/retry. Background errors must not disrupt reporting.
      if (mounted.current && !controller.signal.aborted && version === sequence.current && current.current === token)
        setCount({ owner: token, value: null });
    }).finally(() => { if (pending.current === controller) pending.current = null; });
  }, [token, request]);
  useEffect(() => {
    mounted.current = true; current.current = token; refreshBadge();
    const interval = setInterval(refreshBadge, 30000);
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") refreshBadge(); });
    const focus = () => refreshBadge();
    if (Platform.OS === "web" && typeof window !== "undefined") window.addEventListener("focus", focus);
    return () => {
      mounted.current = false; current.current = undefined; pending.current?.abort(); pending.current = null;
      clearInterval(interval); subscription.remove();
      if (Platform.OS === "web" && typeof window !== "undefined") window.removeEventListener("focus", focus);
    };
  }, [refreshBadge, token]);
  return <NotificationContext.Provider value={{ unreadCount: count.owner === token && token ? count.value : null, syncCount, refreshBadge }}>{children}</NotificationContext.Provider>;
}
export function useNotifications() {
  const value = useContext(NotificationContext);
  if (!value) throw new Error("NotificationProvider is required.");
  return value;
}
