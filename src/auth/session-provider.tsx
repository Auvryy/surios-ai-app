import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import { authApi, apiRequest } from './api';
import { SessionController } from './session-controller';
import { sessionStorage } from './session-storage';
import { ApiError, type ApiOptions } from '../lib/api-client';

const SessionContext = createContext<SessionController | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [controller] = useState(() => new SessionController(authApi, sessionStorage));
  useEffect(() => {
    void controller.restore();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && controller.getSnapshot().session) void controller.restore();
    });
    const focus = () => { if (controller.getSnapshot().session) void controller.restore(); };
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.addEventListener('focus', focus);
    return () => { subscription.remove(); if (Platform.OS === 'web' && typeof window !== 'undefined') window.removeEventListener('focus', focus); };
  }, [controller]);
  return <SessionContext.Provider value={controller}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const controller = useContext(SessionContext);
  if (!controller) throw new Error('SessionProvider is required.');
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const request = useCallback(async <T,>(path: string, options: Omit<ApiOptions, 'token'> = {}): Promise<T> => {
    const token = controller.getSnapshot().session?.accessToken;
    if (!token) throw new ApiError('Sign in to continue.', 401);
    try { return await apiRequest<T>(path, { ...options, token }); }
    catch (error) {
      if (error instanceof ApiError && error.status === 401) await controller.invalidate(token);
      throw error;
    }
  }, [controller]);
  return { ...state, authenticate: controller.authenticate, signOut: controller.signOut,
    retry: controller.restore, cancelAuthentication: controller.cancelAuthentication,
    request,
  };
}
