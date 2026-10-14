import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig, AxiosRequestConfig, isAxiosError } from 'axios';
import { DataRestAdapter } from '../../src/adapters/data/rest';
import { DataProviderResponse, RateLimitInfo } from '../../src/data/types';

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

describe('DataRestAdapter - Rate Limit Handling', () => {
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

        adapter = new DataRestAdapter({
            baseURL: 'https://api.example.com',
            rateLimit: {
                maxRetries: 2,
                baseDelayMs: 100,
                maxDelayMs: 1000,
                respectRetryAfter: true,
            },
        });
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('should parse rate limit headers from successful response', async () => {
        const rateLimitHeaders = {
            'x-ratelimit-limit': '100',
            'x-ratelimit-remaining': '99',
            'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
        };

        const mockResponse: AxiosResponse<DataProviderResponse<any>> = {
            data: { success: true, data: { items: [] }, message: 'OK', status: 'success' },
            status: 200,
            statusText: 'OK',
            headers: rateLimitHeaders,
            config: {} as AxiosRequestConfig,
        };

        mockClient.request!.mockResolvedValue(mockResponse);

        const result = await adapter.fetch('users');

        expect(result.rateLimit).toBeDefined();
        expect(result.rateLimit!.limit).toBe(100);
        expect(result.rateLimit!.remaining).toBe(99);
    });

    it('should parse rate limit headers from 429 error response and retry', async () => {
        const rateLimitHeaders = {
            'x-ratelimit-limit': '100',
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
            'retry-after': '30',
        };

        const errorResponse: AxiosResponse<DataProviderResponse<any>> = {
            data: { success: false, message: 'Too Many Requests', status: 'error', errors: {} },
            status: 429,
            statusText: 'Too Many Requests',
            headers: rateLimitHeaders,
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

        const result = await adapter.fetch('users');

        expect(result.rateLimit).toBeDefined();
        expect(result.rateLimit!.retryAfter).toBeUndefined();
        expect(result.rateLimit!.limit).toBe(100);
        expect(result.rateLimit!.remaining).toBe(99);
    });

    it('should retry on 429 with exponential backoff', async () => {
        const rateLimitHeaders = {
            'x-ratelimit-limit': '100',
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
            'retry-after': '1',
        };

        const errorResponse: AxiosResponse<DataProviderResponse<any>> = {
            data: { success: false, message: 'Too Many Requests', status: 'error', errors: {} },
            status: 429,
            statusText: 'Too Many Requests',
            headers: rateLimitHeaders,
            config: {} as AxiosRequestConfig,
        };

        const axiosError = {
            response: errorResponse,
            isAxiosError: true,
        };

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

        const startTime = Date.now();
        const result = await adapter.fetch('users');
        const elapsed = Date.now() - startTime;

        expect(mockClient.request).toHaveBeenCalledTimes(3);
        expect(result.success).toBe(true);
        expect(elapsed).toBeGreaterThanOrEqual(200);
    });

    it('should respect Retry-After header when present', async () => {
        const rateLimitHeaders = {
            'x-ratelimit-limit': '100',
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
            'retry-after': '2',
        };

        const errorResponse: AxiosResponse<DataProviderResponse<any>> = {
            data: { success: false, message: 'Too Many Requests', status: 'error', errors: {} },
            status: 429,
            statusText: 'Too Many Requests',
            headers: rateLimitHeaders,
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

        const adapterWithHigherMaxDelay = new DataRestAdapter({
            baseURL: 'https://api.example.com',
            rateLimit: {
                maxRetries: 2,
                baseDelayMs: 100,
                maxDelayMs: 3000,
                respectRetryAfter: true,
            },
        });

        const startTime = Date.now();
        const result = await adapterWithHigherMaxDelay.fetch('users');
        const elapsed = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(elapsed).toBeGreaterThanOrEqual(1900);
    });

    it('should call onRateLimit callback when rate limited', async () => {
        const onRateLimit = vi.fn();
        const rateLimitHeaders = {
            'x-ratelimit-limit': '100',
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
            'retry-after': '1',
        };

        const errorResponse: AxiosResponse<DataProviderResponse<any>> = {
            data: { success: false, message: 'Too Many Requests', status: 'error', errors: {} },
            status: 429,
            statusText: 'Too Many Requests',
            headers: rateLimitHeaders,
            config: {} as AxiosRequestConfig,
        };

        const axiosError = {
            response: errorResponse,
            isAxiosError: true,
        };

        mockClient.request!
            .mockRejectedValueOnce(axiosError)
            .mockResolvedValueOnce({
                data: { success: true, data: { items: [] }, message: 'OK', status: 'success' },
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {} as AxiosRequestConfig,
            });

        const adapterWithCallback = new DataRestAdapter({
            baseURL: 'https://api.example.com',
            rateLimit: {
                maxRetries: 2,
                baseDelayMs: 100,
                maxDelayMs: 1000,
                respectRetryAfter: true,
                onRateLimit,
            },
        });

        await adapterWithCallback.fetch('users');

        expect(onRateLimit).toHaveBeenCalledWith(expect.objectContaining({
            limit: 100,
            remaining: 0,
            retryAfter: 1,
        }));
    });

    it('should parse Retry-After as HTTP date', async () => {
        const futureDate = new Date(Date.now() + 5000).toUTCString();
        const rateLimitHeaders = {
            'retry-after': futureDate,
        };

        const errorResponse: AxiosResponse<DataProviderResponse<any>> = {
            data: { success: false, message: 'Too Many Requests', status: 'error', errors: {} },
            status: 429,
            statusText: 'Too Many Requests',
            headers: rateLimitHeaders,
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

        const result = await adapter.fetch('users');

        expect(result.rateLimit).toBeDefined();
    });

    it('should give up after maxRetries and return error with rateLimit info', async () => {
        const rateLimitHeaders = {
            'x-ratelimit-limit': '100',
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
            'retry-after': '1',
        };

        const errorResponse: AxiosResponse<DataProviderResponse<any>> = {
            data: { success: false, message: 'Too Many Requests', status: 'error', errors: {} },
            status: 429,
            statusText: 'Too Many Requests',
            headers: rateLimitHeaders,
            config: {} as AxiosRequestConfig,
        };

        const axiosError = {
            response: errorResponse,
            isAxiosError: true,
        };

        mockClient.request!.mockRejectedValue(axiosError);

        const adapterLimitedRetries = new DataRestAdapter({
            baseURL: 'https://api.example.com',
            rateLimit: {
                maxRetries: 1,
                baseDelayMs: 50,
                maxDelayMs: 100,
                respectRetryAfter: true,
            },
        });

        try {
            await adapterLimitedRetries.fetch('users');
            expect.fail('Expected fetch to throw');
        } catch (error: any) {
            expect(error.response.data.rateLimit).toBeDefined();
            expect(error.response.data.rateLimit.limit).toBe(100);
            expect(error.response.data.rateLimit.remaining).toBe(0);
        }
    });

    it('should handle different rate limit header formats', async () => {
        const testCases = [
            { headers: { 'x-ratelimit-limit': '100', 'x-ratelimit-remaining': '50', 'x-ratelimit-reset': '1234567890' }, expected: { limit: 100, remaining: 50, reset: 1234567890 } },
            { headers: { 'x-rate-limit-limit': '200', 'x-rate-limit-remaining': '100', 'x-rate-limit-reset': '1234567890' }, expected: { limit: 200, remaining: 100, reset: 1234567890 } },
            { headers: { 'ratelimit-limit': '50', 'ratelimit-remaining': '25', 'ratelimit-reset': '1234567890' }, expected: { limit: 50, remaining: 25, reset: 1234567890 } },
        ];

        for (const { headers, expected } of testCases) {
            const mockResponse: AxiosResponse<DataProviderResponse<any>> = {
                data: { success: true, data: { items: [] }, message: 'OK', status: 'success' },
                status: 200,
                statusText: 'OK',
                headers,
                config: {} as AxiosRequestConfig,
            };

            mockClient.request!.mockResolvedValueOnce(mockResponse);

            const result = await adapter.fetch('users');

            expect(result.rateLimit).toEqual(expect.objectContaining(expected));
        }
    });
});