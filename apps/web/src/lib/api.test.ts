import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('../store/auth', () => ({
  useAuthStore: Object.assign(vi.fn(), { getState: vi.fn(() => ({ token: null, logout: vi.fn() })) }),
}));

const mockRequestUse = vi.fn();
const mockResponseUse = vi.fn();
const mockAxiosInstance = {
  interceptors: {
    request: { use: mockRequestUse },
    response: { use: mockResponseUse },
  },
};
const mockCreate = vi.fn(() => mockAxiosInstance);

vi.mock('axios', () => ({
  default: Object.assign(vi.fn(() => mockAxiosInstance), {
    create: mockCreate,
    isAxiosError: vi.fn(),
  }),
}));

let api: typeof import('./api.js');

beforeAll(async () => {
  api = await import('./api.js');
});

describe('API client', () => {
  it('should create axios instance with /api baseURL', async () => {
    expect(mockCreate).toHaveBeenCalledWith({ baseURL: '/api' });
  });

  it('should set up both interceptors', async () => {
    expect(mockRequestUse).toHaveBeenCalledTimes(1);
    expect(mockResponseUse).toHaveBeenCalledTimes(1);
  });

  it('should configure interceptors with functions', async () => {
    const reqArgs = mockRequestUse.mock.calls[0];
    expect(typeof reqArgs[0]).toBe('function');
    const resArgs = mockResponseUse.mock.calls[0];
    expect(typeof resArgs[0]).toBe('function');
    expect(typeof resArgs[1]).toBe('function');
  });

  it('should export default api instance', async () => {
    expect(api.default).toBeDefined();
  });
});
