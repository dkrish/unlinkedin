import { vi, beforeEach } from 'vitest';

const mockStorage: Record<string, unknown> = {};

function makeStorageMock() {
  return {
    get: vi.fn(async (keys: string | string[]) => {
      const ks = typeof keys === 'string' ? [keys] : keys;
      return Object.fromEntries(ks.map((k) => [k, mockStorage[k]]));
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(mockStorage, items);
    }),
    onChanged: { addListener: vi.fn() },
  };
}

vi.stubGlobal('chrome', {
  storage: {
    local: makeStorageMock(),
    sync: makeStorageMock(),
  },
  runtime: {
    sendMessage: vi.fn(),
    lastError: null,
    openOptionsPage: vi.fn(),
  },
});

// Reset storage state between tests to prevent bleed-across
beforeEach(() => {
  for (const key of Object.keys(mockStorage)) {
    delete mockStorage[key];
  }
  vi.clearAllMocks();
});
