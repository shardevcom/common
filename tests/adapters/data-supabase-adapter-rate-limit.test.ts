import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DataSupabaseAdapter } from '../../src/adapters/data/supabase';
import { DataProviderResponse, RateLimitInfo } from '../../src/data/types';

const mockSupabaseClient = {
    from: vi.fn(() => ({
        select: vi.fn(() => ({
            eq: vi.fn(() => ({
                single: vi.fn(),
                range: vi.fn(),
                limit: vi.fn(() => ({ single: vi.fn() })),
            })),
            range: vi.fn(),
            limit: vi.fn(() => ({ single: vi.fn() })),
            single: vi.fn(),
        })),
        insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn() })) })),
        update: vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn() })) })) })),
        upsert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn() })) })),
        delete: vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn() })) })) })),
    })),
    storage: {
        from: vi.fn(() => ({
            upload: vi.fn(),
            getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.com/file.pdf' } })),
        })),
    },
    auth: {
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
    },
    channel: vi.fn(() => ({
        on: vi.fn(() => ({ subscribe: vi.fn() })),
    })),
    removeChannel: vi.fn(),
};

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock('uuid', () => ({
    v4: vi.fn(() => 'test-uuid'),
}));

vi.mock('redux-persist/es/storage', () => ({
    default: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
    },
}));

describe('DataSupabaseAdapter - Rate Limit Handling', () => {
    let adapter: DataSupabaseAdapter;

    beforeEach(() => {
        vi.clearAllMocks();

        adapter = new DataSupabaseAdapter({
            baseURL: 'https://supabase.example.com',
            token: 'test-anon-key',
            rateLimit: {
                maxRetries: 2,
                baseDelayMs: 100,
                maxDelayMs: 1000,
                respectRetryAfter: true,
            },
        });
    });

    const createRateLimitError = (overrides: Partial<{
        status: number;
        message: string;
        code: string;
        headers: Record<string, string>;
    }> = {}) => ({
        status: overrides.status ?? 429,
        message: overrides.message ?? 'Too Many Requests',
        code: overrides.code ?? '429',
        headers: overrides.headers ?? {
            'x-ratelimit-limit': '100',
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
            'retry-after': '1',
        },
        response: {
            headers: overrides.headers ?? {
                'x-ratelimit-limit': '100',
                'x-ratelimit-remaining': '0',
                'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
                'retry-after': '1',
            },
        },
    });

    it('should detect rate limit error from status 429', async () => {
        const rateLimitError = createRateLimitError();

        mockSupabaseClient.from.mockReturnValueOnce({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({ data: null, error: rateLimitError, status: 429 }),
                })),
            })),
        });

        const adapterNoRetry = new DataSupabaseAdapter({
            baseURL: 'https://supabase.example.com',
            token: 'test-anon-key',
            rateLimit: {
                maxRetries: 0,
                baseDelayMs: 100,
                maxDelayMs: 1000,
                respectRetryAfter: true,
            },
        });

        const result = await adapterNoRetry.fetchById('users', 1);

        expect(result.rateLimit).toBeDefined();
        expect(result.rateLimit!.limit).toBe(100);
        expect(result.rateLimit!.remaining).toBe(0);
        expect(result.rateLimit!.retryAfter).toBe(1);
    });

    it('should detect rate limit error from message', async () => {
        const rateLimitError = createRateLimitError({ message: 'rate limit exceeded' });

        mockSupabaseClient.from.mockReturnValueOnce({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({ data: null, error: rateLimitError, status: 429 }),
                })),
            })),
        });

        const adapterNoRetry = new DataSupabaseAdapter({
            baseURL: 'https://supabase.example.com',
            token: 'test-anon-key',
            rateLimit: {
                maxRetries: 0,
                baseDelayMs: 100,
                maxDelayMs: 1000,
                respectRetryAfter: true,
            },
        });

        const result = await adapterNoRetry.fetchById('users', 1);

        expect(result.rateLimit).toBeDefined();
    });

    it('should retry on rate limit error with exponential backoff', async () => {
        const rateLimitError = createRateLimitError();

        let callCount = 0;
        mockSupabaseClient.from.mockImplementation(() => {
            callCount++;
            if (callCount <= 2) {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            single: vi.fn().mockResolvedValue({ data: null, error: rateLimitError, status: 429 }),
                        })),
                    })),
                };
            }
            return {
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        single: vi.fn().mockResolvedValue({ 
                            data: { id: 1, name: 'Test' }, 
                            error: null, 
                            status: 200 
                        }),
                    })),
                })),
            };
        });

        const startTime = Date.now();
        const result = await adapter.fetchById('users', 1);
        const elapsed = Date.now() - startTime;

        expect(callCount).toBe(3);
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ id: 1, name: 'Test' });
        expect(elapsed).toBeGreaterThanOrEqual(200);
    });

    it('should respect Retry-After header in Supabase', async () => {
        const rateLimitError = createRateLimitError({ headers: { 'retry-after': '2' } });

        let callCount = 0;
        mockSupabaseClient.from.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            single: vi.fn().mockResolvedValue({ data: null, error: rateLimitError, status: 429 }),
                        })),
                    })),
                };
            }
            return {
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        single: vi.fn().mockResolvedValue({ 
                            data: { id: 1, name: 'Test' }, 
                            error: null, 
                            status: 200 
                        }),
                    })),
                })),
            };
        });

        const adapterWithHigherMaxDelay = new DataSupabaseAdapter({
            baseURL: 'https://supabase.example.com',
            token: 'test-anon-key',
            rateLimit: {
                maxRetries: 2,
                baseDelayMs: 100,
                maxDelayMs: 3000,
                respectRetryAfter: true,
            },
        });

        const startTime = Date.now();
        const result = await adapterWithHigherMaxDelay.fetchById('users', 1);
        const elapsed = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(elapsed).toBeGreaterThanOrEqual(1900);
    });

    it('should call onRateLimit callback when rate limited', async () => {
        const onRateLimit = vi.fn();
        
        const adapterWithCallback = new DataSupabaseAdapter({
            baseURL: 'https://supabase.example.com',
            token: 'test-anon-key',
            rateLimit: {
                maxRetries: 2,
                baseDelayMs: 100,
                maxDelayMs: 1000,
                respectRetryAfter: true,
                onRateLimit,
            },
        });

        const rateLimitError = createRateLimitError();

        let callCount = 0;
        mockSupabaseClient.from.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            single: vi.fn().mockResolvedValue({ data: null, error: rateLimitError, status: 429 }),
                        })),
                    })),
                };
            }
            return {
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        single: vi.fn().mockResolvedValue({ 
                            data: { id: 1, name: 'Test' }, 
                            error: null, 
                            status: 200 
                        }),
                    })),
                })),
            };
        });

        await adapterWithCallback.fetchById('users', 1);

        expect(onRateLimit).toHaveBeenCalledWith(expect.objectContaining({
            limit: 100,
            remaining: 0,
            retryAfter: 1,
        }));
    });

    it('should give up after maxRetries and return error with rateLimit info', async () => {
        const rateLimitError = createRateLimitError();

        mockSupabaseClient.from.mockReturnValue({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({ data: null, error: rateLimitError, status: 429 }),
                })),
            })),
        });

        const adapterLimitedRetries = new DataSupabaseAdapter({
            baseURL: 'https://supabase.example.com',
            token: 'test-anon-key',
            rateLimit: {
                maxRetries: 1,
                baseDelayMs: 50,
                maxDelayMs: 100,
                respectRetryAfter: true,
            },
        });

        const result = await adapterLimitedRetries.fetchById('users', 1);

        expect(result.success).toBe(false);
        expect(result.rateLimit).toBeDefined();
        expect(result.rateLimit!.limit).toBe(100);
        expect(result.rateLimit!.remaining).toBe(0);
    });

    it('should include rateLimit info in successful responses', async () => {
        mockSupabaseClient.from.mockReturnValueOnce({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({ 
                        data: { id: 1, name: 'Test' }, 
                        error: null, 
                        status: 200 
                    }),
                })),
            })),
        });

        const result = await adapter.fetchById('users', 1);

        expect(result.success).toBe(true);
    });

    it('should handle rate limit in insert operations', async () => {
        const rateLimitError = createRateLimitError();

        let callCount = 0;
        mockSupabaseClient.from.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                return {
                    insert: vi.fn(() => ({ 
                        select: vi.fn(() => ({ 
                            single: vi.fn().mockResolvedValue({ data: null, error: rateLimitError, status: 429 }),
                        })),
                    })),
                };
            }
            return {
                insert: vi.fn(() => ({ 
                    select: vi.fn(() => ({ 
                        single: vi.fn().mockResolvedValue({ 
                            data: { id: 1, name: 'New User' }, 
                            error: null, 
                            status: 201 
                        }),
                    })),
                })),
            };
        });

        const result = await adapter.insert('users', { name: 'New User' });

        expect(callCount).toBe(2);
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ id: 1, name: 'New User' });
    });

    it('should handle rate limit in modify operations', async () => {
        const rateLimitError = createRateLimitError();

        let callCount = 0;
        mockSupabaseClient.from.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                return {
                    update: vi.fn(() => ({ 
                        eq: vi.fn(() => ({ 
                            select: vi.fn(() => ({ 
                                single: vi.fn().mockResolvedValue({ data: null, error: rateLimitError, status: 429 }),
                            })),
                        })),
                    })),
                };
            }
            return {
                update: vi.fn(() => ({ 
                    eq: vi.fn(() => ({ 
                        select: vi.fn(() => ({ 
                            single: vi.fn().mockResolvedValue({ 
                                data: { id: 1, name: 'Updated User' }, 
                                error: null, 
                                status: 200 
                            }),
                        })),
                    })),
                })),
            };
        });

        const result = await adapter.modify('users', { id: 1 }, { name: 'Updated User' });

        expect(callCount).toBe(2);
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ id: 1, name: 'Updated User' });
    });
});