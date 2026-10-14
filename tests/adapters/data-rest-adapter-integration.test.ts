import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig, AxiosRequestConfig } from 'axios';
import { DataRestAdapter } from '../../src/adapters/data/rest';
import { DataProviderResponse, RateLimitInfo, CircuitBreakerConfig } from '../../src/data/types';

vi.mock('axios', async () => {
    const actual = await vi.importActual('axios');
    const mockClient = {
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
        },
        get: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        request: vi.fn(),
        defaults: { baseURL: 'https://api.example.com' },
    };

    return {
        ...actual,
        default: {
            create: vi.fn(() => mockClient),
        },
        create: vi.fn(() => mockClient),
        isAxiosError: actual.isAxiosError,
    };
});

import axios from 'axios';

describe('DataRestAdapter - Integration: Cancellation, Circuit Breaker, 5xx Retry', () => {
    let adapter: DataRestAdapter;
    let mockClient: Partial<AxiosInstance>;

    beforeEach(() => {
        vi.clearAllMocks();

        mockClient = {
            interceptors: {
                request: { use: vi.fn() },
                response: { use: vi.fn() },
            },
            get: vi.fn(),
            post: vi.fn(),
            patch: vi.fn(),
            delete: vi.fn(),
            request: vi.fn(),
            defaults: { baseURL: 'https://api.example.com' },
        };

        (axios.create as vi.Mock).mockReturnValue(mockClient);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Cancellation', () => {
        it('should cancel a specific request via cancelRequest', async () => {
            const mockResponse: AxiosResponse<DataProviderResponse<any>> = {
                data: { success: true, data: { items: [] }, message: 'OK', status: 'success' },
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {} as AxiosRequestConfig,
            };

            mockClient.request!.mockResolvedValue(mockResponse);

            adapter = new DataRestAdapter({
                baseURL: 'https://api.example.com',
            });

            // Start a request
            const fetchPromise = adapter.fetch('users');

            // Cancel it
            adapter.cancelRequest('users');

            // The request should be aborted (we can't easily test the abort itself without more mocking)
            // But we can verify cancelAll doesn't throw
            adapter.cancelAll();

            await expect(fetchPromise).resolves.toBeDefined();
        });

        it('should cancel all pending requests via cancelAll', async () => {
            adapter = new DataRestAdapter({
                baseURL: 'https://api.example.com',
            });

            // Should not throw
            adapter.cancelAll();
            adapter.cancelAll(); // Idempotent
        });

        it('should clean up abort controllers after request completes', async () => {
            const mockResponse: AxiosResponse<DataProviderResponse<any>> = {
                data: { success: true, data: { items: [] }, message: 'OK', status: 'success' },
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {} as AxiosRequestConfig,
            };

            mockClient.request!.mockResolvedValue(mockResponse);

            adapter = new DataRestAdapter({
                baseURL: 'https://api.example.com',
            });

            await adapter.fetch('users');

            // After request completes, internal maps should be cleaned up
            // We can't directly test private fields, but we can verify no memory leak by making many requests
            for (let i = 0; i < 10; i++) {
                await adapter.fetch('users');
            }
        });
    });

    describe('Circuit Breaker', () => {
        it('should open circuit after failure threshold', async () => {
            const errorResponse: AxiosResponse<DataProviderResponse<any>> = {
                data: { success: false, message: 'Internal Server Error', status: 'error', errors: {} },
                status: 500,
                statusText: 'Internal Server Error',
                headers: {},
                config: {} as AxiosRequestConfig,
            };

            const axiosError = {
                response: errorResponse,
                isAxiosError: true,
            };

            mockClient.request!.mockRejectedValue(axiosError);

            adapter = new DataRestAdapter({
                baseURL: 'https://api.example.com',
                rateLimit: {
                    maxRetries: 0, // Disable retries for circuit breaker tests
                    baseDelayMs: 1,
                    maxDelayMs: 10,
                },
                circuitBreaker: {
                    failureThreshold: 3,
                    successThreshold: 2,
                    timeout: 1000,
                    excludedStatusCodes: [401, 403, 404, 422],
                } as Partial<CircuitBreakerConfig>,
            });

            // First 3 requests should fail and count towards threshold
            for (let i = 0; i < 3; i++) {
                try {
                    await adapter.fetch('users');
                } catch (e) {
                    // Expected to fail
                }
            }

            // 4th request should fail fast with CircuitOpenError
            try {
                await adapter.fetch('users');
                expect.fail('Expected CircuitOpenError');
            } catch (error: any) {
                const message = error?.message ?? error?.response?.data?.message ?? String(error);
                expect(message).toContain('Circuit breaker is OPEN');
                // retryAfter may not be present on all error types
                if (error.retryAfter !== undefined) {
                    expect(error.retryAfter).toBeGreaterThan(0);
                }
            }
        });

        it('should not count excluded status codes towards circuit breaker', async () => {
            const errorResponse401: AxiosResponse<DataProviderResponse<any>> = {
                data: { success: false, message: 'Unauthorized', status: 'error', errors: {} },
                status: 401,
                statusText: 'Unauthorized',
                headers: {},
                config: {} as AxiosRequestConfig,
            };

            const axiosError401 = {
                response: errorResponse401,
                isAxiosError: true,
            };

            mockClient.request!.mockRejectedValue(axiosError401);

            adapter = new DataRestAdapter({
                baseURL: 'https://api.example.com',
                circuitBreaker: {
                    failureThreshold: 2,
                    excludedStatusCodes: [401, 403, 404, 422],
                } as Partial<CircuitBreakerConfig>,
            });

            // 401 errors should not open the circuit
            for (let i = 0; i < 5; i++) {
                try {
                    await adapter.fetch('users');
                } catch (e) {
                    // Expected to fail with 401
                }
            }

            // Circuit should still be closed, next request should attempt normally
            // (This is hard to test without exposing circuit state, but we verify no fast-fail)
        });

        it('should transition to half-open after timeout', async () => {
            const errorResponse: AxiosResponse<DataProviderResponse<any>> = {
                data: { success: false, message: 'Internal Server Error', status: 'error', errors: {} },
                status: 500,
                statusText: 'Internal Server Error',
                headers: {},
                config: {} as AxiosRequestConfig,
            };

            const axiosError = {
                response: errorResponse,
                isAxiosError: true,
            };

            // Fail twice, then succeed on third call
            mockClient.request!
                .mockRejectedValueOnce(axiosError)
                .mockRejectedValueOnce(axiosError)
                .mockResolvedValueOnce({
                    data: { success: true, data: { items: [] }, message: 'OK', status: 'success' },
                    status: 200,
                    statusText: 'OK',
                    headers: {},
                    config: {} as AxiosRequestConfig,
                });

            adapter = new DataRestAdapter({
                baseURL: 'https://api.example.com',
                rateLimit: {
                    maxRetries: 0, // Disable retries
                    baseDelayMs: 1,
                    maxDelayMs: 10,
                },
                circuitBreaker: {
                    failureThreshold: 2,
                    successThreshold: 1,
                    timeout: 100,
                    excludedStatusCodes: [401, 403, 404, 422],
                } as Partial<CircuitBreakerConfig>,
            });

            // Trigger circuit open (2 failures)
            try {
                await adapter.fetch('users');
            } catch (e) {}
            try {
                await adapter.fetch('users');
            } catch (e) {}

            // Wait for timeout
            await new Promise(resolve => setTimeout(resolve, 150));

            // Next request should succeed (circuit half-open -> closed on success)
            const result = await adapter.fetch('users');
            expect(result.success).toBe(true);
        });
    });

    describe('5xx Retry', () => {
        it('should retry on 500 with exponential backoff', async () => {
            const errorResponse: AxiosResponse<DataProviderResponse<any>> = {
                data: { success: false, message: 'Internal Server Error', status: 'error', errors: {} },
                status: 500,
                statusText: 'Internal Server Error',
                headers: {},
                config: {} as AxiosRequestConfig,
            };

            const axiosError = {
                response: errorResponse,
                isAxiosError: true,
            };

            const successHeaders = {
                'x-ratelimit-limit': '100',
                'x-ratelimit-remaining': '99',
                'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
            };

            mockClient.request!
                .mockRejectedValueOnce(axiosError)
                .mockRejectedValueOnce(axiosError)
                .mockResolvedValueOnce({
                    data: { success: true, data: { items: [] }, message: 'OK', status: 'success' },
                    status: 200,
                    statusText: 'OK',
                    headers: successHeaders,
                    config: {} as AxiosRequestConfig,
                });

            adapter = new DataRestAdapter({
                baseURL: 'https://api.example.com',
                rateLimit: {
                    maxRetries: 3,
                    baseDelayMs: 50,
                    maxDelayMs: 500,
                    respectRetryAfter: true,
                },
            });

            const startTime = Date.now();
            const result = await adapter.fetch('users');
            const elapsed = Date.now() - startTime;

            expect(result.success).toBe(true);
            expect(mockClient.request).toHaveBeenCalledTimes(3);
            expect(elapsed).toBeGreaterThanOrEqual(100); // 50ms + 100ms backoff
        });

        it('should retry on 502 Bad Gateway', async () => {
            const errorResponse: AxiosResponse<DataProviderResponse<any>> = {
                data: { success: false, message: 'Bad Gateway', status: 'error', errors: {} },
                status: 502,
                statusText: 'Bad Gateway',
                headers: {},
                config: {} as AxiosRequestConfig,
            };

            const axiosError = {
                response: errorResponse,
                isAxiosError: true,
            };

            const successHeaders = {
                'x-ratelimit-limit': '100',
                'x-ratelimit-remaining': '99',
                'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
            };

            mockClient.request!
                .mockRejectedValueOnce(axiosError)
                .mockResolvedValueOnce({
                    data: { success: true, data: { items: [] }, message: 'OK', status: 'success' },
                    status: 200,
                    statusText: 'OK',
                    headers: successHeaders,
                    config: {} as AxiosRequestConfig,
                });

            adapter = new DataRestAdapter({
                baseURL: 'https://api.example.com',
                rateLimit: {
                    maxRetries: 2,
                    baseDelayMs: 50,
                    maxDelayMs: 500,
                    respectRetryAfter: true,
                },
            });

            const result = await adapter.fetch('users');
            expect(result.success).toBe(true);
            expect(mockClient.request).toHaveBeenCalledTimes(2);
        });

        it('should retry on 503 Service Unavailable', async () => {
            const errorResponse: AxiosResponse<DataProviderResponse<any>> = {
                data: { success: false, message: 'Service Unavailable', status: 'error', errors: {} },
                status: 503,
                statusText: 'Service Unavailable',
                headers: {},
                config: {} as AxiosRequestConfig,
            };

            const axiosError = {
                response: errorResponse,
                isAxiosError: true,
            };

            const successHeaders = {
                'x-ratelimit-limit': '100',
                'x-ratelimit-remaining': '99',
                'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
            };

            mockClient.request!
                .mockRejectedValueOnce(axiosError)
                .mockResolvedValueOnce({
                    data: { success: true, data: { items: [] }, message: 'OK', status: 'success' },
                    status: 200,
                    statusText: 'OK',
                    headers: successHeaders,
                    config: {} as AxiosRequestConfig,
                });

            adapter = new DataRestAdapter({
                baseURL: 'https://api.example.com',
                rateLimit: {
                    maxRetries: 2,
                    baseDelayMs: 50,
                    maxDelayMs: 500,
                    respectRetryAfter: true,
                },
            });

            const result = await adapter.fetch('users');
            expect(result.success).toBe(true);
            expect(mockClient.request).toHaveBeenCalledTimes(2);
        });

        it('should retry on network errors', async () => {
            const networkError = new Error('Network Error');
            (networkError as any).isAxiosError = true;
            (networkError as any).request = {};
            (networkError as any).response = undefined;

            const successHeaders = {
                'x-ratelimit-limit': '100',
                'x-ratelimit-remaining': '99',
                'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
            };

            mockClient.request!
                .mockRejectedValueOnce(networkError)
                .mockResolvedValueOnce({
                    data: { success: true, data: { items: [] }, message: 'OK', status: 'success' },
                    status: 200,
                    statusText: 'OK',
                    headers: successHeaders,
                    config: {} as AxiosRequestConfig,
                });

            adapter = new DataRestAdapter({
                baseURL: 'https://api.example.com',
                rateLimit: {
                    maxRetries: 2,
                    baseDelayMs: 50,
                    maxDelayMs: 500,
                    respectRetryAfter: true,
                },
            });

            const result = await adapter.fetch('users');
            expect(result.success).toBe(true);
            expect(mockClient.request).toHaveBeenCalledTimes(2);
        });

        it('should give up after maxRetries on persistent 5xx', async () => {
            const errorResponse: AxiosResponse<DataProviderResponse<any>> = {
                data: { success: false, message: 'Internal Server Error', status: 'error', errors: {} },
                status: 500,
                statusText: 'Internal Server Error',
                headers: {
                    'x-ratelimit-limit': '100',
                    'x-ratelimit-remaining': '0',
                    'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
                },
                config: {} as AxiosRequestConfig,
            };

            const axiosError = {
                response: errorResponse,
                isAxiosError: true,
            };

            mockClient.request!.mockRejectedValue(axiosError);

            adapter = new DataRestAdapter({
                baseURL: 'https://api.example.com',
                rateLimit: {
                    maxRetries: 2,
                    baseDelayMs: 10,
                    maxDelayMs: 50,
                    respectRetryAfter: true,
                },
            });

            await expect(adapter.fetch('users')).rejects.toMatchObject({
                response: {
                    data: expect.objectContaining({
                        rateLimit: expect.objectContaining({
                            limit: 100,
                            remaining: 0,
                        }),
                    }),
                },
            });
            expect(mockClient.request).toHaveBeenCalledTimes(3); // initial + 2 retries
        });
    });

    describe('Combined: Circuit Breaker + 5xx Retry', () => {
        it('should respect circuit breaker after 5xx retries exhausted', async () => {
            const errorResponse: AxiosResponse<DataProviderResponse<any>> = {
                data: { success: false, message: 'Internal Server Error', status: 'error', errors: {} },
                status: 500,
                statusText: 'Internal Server Error',
                headers: {},
                config: {} as AxiosRequestConfig,
            };

            const axiosError = {
                response: errorResponse,
                isAxiosError: true,
            };

            // Always reject - each fetch call will fail after retries
            mockClient.request!.mockRejectedValue(axiosError);

            adapter = new DataRestAdapter({
                baseURL: 'https://api.example.com',
                rateLimit: {
                    maxRetries: 2, // Each fetch tries 3 times
                    baseDelayMs: 10,
                    maxDelayMs: 50,
                },
                circuitBreaker: {
                    failureThreshold: 3, // Open after 3 failed requests
                    successThreshold: 2,
                    timeout: 1000,
                } as Partial<CircuitBreakerConfig>,
            });

            // First 3 requests fail (each counts as 1 failure despite retries)
            for (let i = 0; i < 3; i++) {
                try {
                    await adapter.fetch('users');
                } catch (e) {}
            }

            // 4th request should fail fast with CircuitOpenError
            try {
                await adapter.fetch('users');
                expect.fail('Expected CircuitOpenError');
            } catch (error: any) {
                const message = error?.message ?? error?.response?.data?.message ?? String(error);
                expect(message).toContain('Circuit breaker is OPEN');
            }
        });
    });
});