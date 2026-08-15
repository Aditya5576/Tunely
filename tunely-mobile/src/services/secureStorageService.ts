import * as SecureStore from 'expo-secure-store';

export const secureStorageService = {
  async getSecureItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      console.warn(`[SecureStorageService] Failed to read key "${key}":`, e);
      return null;
    }
  },

  async setSecureItem(key: string, value: string): Promise<boolean> {
    try {
      await SecureStore.setItemAsync(key, value);
      return true;
    } catch (e) {
      console.warn(`[SecureStorageService] Failed to set key "${key}":`, e);
      return false;
    }
  },

  async deleteSecureItem(key: string): Promise<boolean> {
    try {
      await SecureStore.deleteItemAsync(key);
      return true;
    } catch (e) {
      console.warn(`[SecureStorageService] Failed to delete key "${key}":`, e);
      return false;
    }
  },
};
