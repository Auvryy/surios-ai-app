import * as SecureStore from 'expo-secure-store';
import { apiOrigin } from './api';
import { SESSION_STORAGE_KEY, serializeToken, storedToken, type TokenStorage } from './stored-session';

export const sessionStorage: TokenStorage = {
  async read() {
    const value = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);
    return value ? storedToken(value, apiOrigin()) : null;
  },
  async write(token) {
    await SecureStore.setItemAsync(SESSION_STORAGE_KEY, serializeToken(token, apiOrigin()), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  async clear() { await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY); },
};
