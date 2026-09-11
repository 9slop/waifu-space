import '@testing-library/jest-dom/vitest';
import { GlobalWindow } from 'happy-dom';

// Polyfill window and DOM if running directly in node/bun without environment runner
if (typeof window === 'undefined') {
  const happyWindow = new GlobalWindow();
  (globalThis as any).window = happyWindow;
  (globalThis as any).document = happyWindow.document;
  (globalThis as any).localStorage = happyWindow.localStorage;
  (globalThis as any).sessionStorage = happyWindow.sessionStorage;
  (globalThis as any).navigator = happyWindow.navigator;
  (globalThis as any).HTMLElement = happyWindow.HTMLElement;
  (globalThis as any).SVGElement = happyWindow.SVGElement;
  (globalThis as any).customElements = happyWindow.customElements;
  (globalThis as any).Event = happyWindow.Event;
  (globalThis as any).CustomEvent = happyWindow.CustomEvent;
  (globalThis as any).Node = happyWindow.Node;
  (globalThis as any).HTMLCanvasElement = happyWindow.HTMLCanvasElement;
}

// Mock matchMedia
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    })
  });
}

// Mock URL.createObjectURL & revokeObjectURL
if (!URL.createObjectURL) {
  URL.createObjectURL = () => 'blob:mock-url';
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = () => {};
}

// Mock Canvas 2D Context
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = (() => {
    return {
      fillRect: () => {},
      clearRect: () => {},
      getImageData: () => ({ data: new Array(4) }),
      putImageData: () => {},
      createImageData: () => [],
      setTransform: () => {},
      drawImage: () => {},
      save: () => {},
      fillText: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      stroke: () => {},
      translate: () => {},
      scale: () => {},
      rotate: () => {},
      arc: () => {},
      fill: () => {},
      measureText: () => ({ width: 0 }),
      transform: () => {},
      rect: () => {},
      clip: () => {},
      setLineDash: () => {},
      getLineDash: () => []
    } as any;
  }) as any;
}

// Mock Web Audio Context
if (typeof window !== 'undefined') {
  (window as any).AudioContext = class {
    currentTime = 0;
    createOscillator() {
      return {
        connect: () => {},
        frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
        type: 'sine',
        start: () => {},
        stop: () => {}
      };
    }
    createGain() {
      return {
        connect: () => {},
        gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {} }
      };
    }
    destination = {};
  };
}

// Preserve Cookie & Set-Cookie headers in happy-dom test runner
const OrigRequest = globalThis.Request;
const OrigResponse = globalThis.Response;

if (OrigRequest) {
  globalThis.Request = class extends OrigRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      super(input, init);
      if (init?.headers) {
        if (typeof (init.headers as any).forEach === 'function') {
          (init.headers as any).forEach((v: string, k: string) => {
            if (k.toLowerCase() === 'cookie') this.headers.set(k, v);
          });
        } else if (typeof init.headers === 'object') {
          for (const [k, v] of Object.entries(init.headers)) {
            if (k.toLowerCase() === 'cookie' && typeof v === 'string') {
              this.headers.set(k, v);
            }
          }
        }
      }
    }
  } as typeof Request;
}

if (OrigResponse) {
  globalThis.Response = class extends OrigResponse {
    constructor(body?: BodyInit | null, init?: ResponseInit) {
      super(body, init);
      if (init?.headers) {
        if (typeof (init.headers as any).forEach === 'function') {
          (init.headers as any).forEach((v: string, k: string) => {
            if (k.toLowerCase() === 'set-cookie' || k.toLowerCase() === 'cookie') {
              this.headers.set(k, v);
            }
          });
        } else if (typeof init.headers === 'object') {
          for (const [k, v] of Object.entries(init.headers)) {
            if ((k.toLowerCase() === 'set-cookie' || k.toLowerCase() === 'cookie') && typeof v === 'string') {
              this.headers.set(k, v);
            }
          }
        }
      }
    }
  } as typeof Response;
}
