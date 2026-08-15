import AsyncStorage from '@react-native-async-storage/async-storage';

export const storageService = {
  async getItem<T>(key: string, fallback: T): Promise<T> {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    } catch (e) {
      console.warn(`[StorageService] Failed to read key "${key}":`, e);
      return fallback;
    }
  },

  async setItem<T>(key: string, value: T): Promise<boolean> {
    try {
      const json = JSON.stringify(value);
      await AsyncStorage.setItem(key, json);
      return true;
    } catch (e) {
      console.warn(`[StorageService] Failed to write key "${key}":`, e);
      return false;
    }
  },

  async removeItem(key: string): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn(`[StorageService] Failed to remove key "${key}":`, e);
      return false;
    }
  },

  async clearAll(): Promise<boolean> {
    try {
      await AsyncStorage.clear();
      return true;
    } catch (e) {
      console.warn('[StorageService] Failed to clear storage:', e);
      return false;
    }
  },
};
