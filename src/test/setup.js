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

  // Mock navigator.mediaDevices.enumerateDevices to prevent JSDOM promise hangs
  if (navigator.mediaDevices) {
    navigator.mediaDevices.enumerateDevices = vi.fn().mockResolvedValue([]);
  } else {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([]),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      },
      writable: true,
      configurable: true
    });
  }

  // Override HTMLMediaElement.src to prevent jsdom network resource loader hangs
  Object.defineProperty(window.HTMLMediaElement.prototype, 'src', {
    get() { return this._src || ''; },
    set(url) { this._src = url; },
    configurable: true,
    enumerable: true
  });

  // Mock HTMLMediaElement play/pause/load methods for jsdom
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
  window.HTMLMediaElement.prototype.load = vi.fn();

  class MockAudio extends EventTarget {
    constructor(src = '') {
      super();
      this._src = src;
      this.volume = 1;
      this.currentTime = 0;
      this.duration = 180;
      this.readyState = 4;
      this.play = vi.fn().mockResolvedValue(undefined);
      this.pause = vi.fn();
      this.load = vi.fn();
    }
    get src() { return this._src; }
    set src(v) { this._src = v; }
  }
  window.Audio = MockAudio;
  global.Audio = MockAudio;

  // Mock global fetch by default to prevent JSDOM network hangs
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: [] }),
    text: async () => ''
  });
}
