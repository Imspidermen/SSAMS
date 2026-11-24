import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

/**
 * jsdom does not implement these browser APIs.
 *
 * They are installed as plain functions rather than `vi.fn()` on purpose: the
 * Vitest config sets `restoreMocks: true`, which wipes mock implementations
 * before every test and would leave `window.matchMedia()` returning undefined.
 */
interface MediaQueryListStub {
  matches: boolean;
  media: string;
  onchange: null;
  addListener: () => void;
  removeListener: () => void;
  addEventListener: () => void;
  removeEventListener: () => void;
  dispatchEvent: () => boolean;
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query: string): MediaQueryListStub => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

if (!window.scrollTo) {
  window.scrollTo = (() => undefined) as unknown as typeof window.scrollTo;
}

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

// Recharts measures its container; without a size it renders nothing and logs
// warnings that obscure real failures.
if (!SVGElement.prototype.getBoundingClientRect) {
  SVGElement.prototype.getBoundingClientRect = (() => ({
    width: 600,
    height: 300,
    top: 0,
    left: 0,
    right: 600,
    bottom: 300,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })) as unknown as () => DOMRect;
}

// Camera, geolocation and clipboard are exercised through explicit stubs in the
// tests that need them; declaring them here keeps feature detection honest.
if (!navigator.mediaDevices) {
  Object.defineProperty(navigator, 'mediaDevices', {
    writable: true,
    configurable: true,
    value: undefined,
  });
}

if (!navigator.geolocation) {
  Object.defineProperty(navigator, 'geolocation', {
    writable: true,
    configurable: true,
    value: undefined,
  });
}

// Swallow the "not wrapped in act" noise from polling queries in tests that
// intentionally leave a query in flight.
vi.stubGlobal('__SSAMS_TEST__', true);
