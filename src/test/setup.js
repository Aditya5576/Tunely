import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Ensure robust localStorage mock for jsdom environment
if (typeof window !== 'undefined') {
  const createStorageMock = () => {
    let store = {};
    return {
      getItem: (key) => (key in store ? store[key] : null),
      setItem: (key, value) => { store[key] = String(value); },
      removeItem: (key) => { delete store[key]; },
      clear: () => { store = {}; },
      get length() { return Object.keys(store).length; },
      key: (i) => Object.keys(store)[i] || null
    };
  };

  const storageMock = createStorageMock();
  Object.defineProperty(window, 'localStorage', { value: storageMock, writable: true, configurable: true });
  Object.defineProperty(global, 'localStorage', { value: storageMock, writable: true, configurable: true });

  // Mock HTMLMediaElement play/pause methods for jsdom
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
  window.HTMLMediaElement.prototype.load = vi.fn();
}
