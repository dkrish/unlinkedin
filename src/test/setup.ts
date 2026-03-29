import { vi } from 'vitest';

// In-memory backing store shared across local + sync mocks
const mockStorage: Record<string, unknown> = {};

const storageMock = {
  get: vi.fn(async (keys: string | string[]) => {
    const ks = typeof keys === 'string' ? [keys] : keys;
    return Object.fromEntries(ks.map((k) => [k, mockStorage[k]]));
  }),
  set: vi.fn(async (items: Record<string, unknown>) => {
    Object.assign(mockStorage, items);
  }),
  onChanged: { addListener: vi.fn() },
};

vi.stubGlobal('chrome', {
  storage: {
    local: storageMock,
    sync: { ...storageMock, onChanged: { addListener: vi.fn() } },
  },
  runtime: {
    sendMessage: vi.fn(),
    lastError: null,
    openOptionsPage: vi.fn(),
  },
});
