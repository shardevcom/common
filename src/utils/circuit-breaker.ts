export interface CircuitBreakerConfig {
    failureThreshold?: number;
    successThreshold?: number;
    timeout?: number;
    excludedStatusCodes?: number[];
    onStateChange?: (state: CircuitState) => void;
}

export enum CircuitState {
    CLOSED = 'CLOSED',
    OPEN = 'OPEN',
    HALF_OPEN = 'HALF_OPEN',
}

export class CircuitOpenError extends Error {
    constructor(
        message: string,
        public readonly retryAfter: number
    ) {
        super(message);
        this.name = 'CircuitOpenError';
    }
}

export class CircuitBreaker {
    private state = CircuitState.CLOSED;
    private failures = 0;
    private successes = 0;
    private lastFailureTime = 0;
    private readonly config: Required<CircuitBreakerConfig>;

    constructor(config: CircuitBreakerConfig) {
        this.config = {
            failureThreshold: config.failureThreshold ?? 5,
            successThreshold: config.successThreshold ?? 2,
            timeout: config.timeout ?? 30000,
            excludedStatusCodes: config.excludedStatusCodes ?? [401, 403, 404, 422],
            onStateChange: config.onStateChange ?? (() => {}),
        };
    }

    getState(): CircuitState {
        return this.state;
    }

    getFailureCount(): number {
        return this.failures;
    }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === CircuitState.OPEN) {
            if (Date.now() - this.lastFailureTime > this.config.timeout) {
                this.transitionToHalfOpen();
            } else {
                const retryAfter = Math.ceil((this.config.timeout - (Date.now() - this.lastFailureTime)) / 1000);
                throw new CircuitOpenError('Circuit breaker is OPEN', retryAfter);
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure(error);
            throw error;
        }
    }

    private onSuccess() {
        this.failures = 0;

        if (this.state === CircuitState.HALF_OPEN) {
            this.successes++;
            if (this.successes >= this.config.successThreshold) {
                this.transitionToClosed();
            }
        }
    }

    private onFailure(error: unknown) {
        this.lastFailureTime = Date.now();
        const status = this.extractStatus(error);

        if (this.config.excludedStatusCodes?.includes(status)) {
            return;
        }

        this.failures++;

        if (this.state === CircuitState.HALF_OPEN) {
            this.transitionToOpen();
        } else if (this.failures >= this.config.failureThreshold) {
            this.transitionToOpen();
        }
    }

    private extractStatus(error: unknown): number {
        if (!error || typeof error !== 'object') return 0;

        if ('response' in error && error.response && typeof error.response === 'object') {
            const response = error.response as { status?: number };
            if (typeof response.status === 'number') return response.status;
        }

        if ('status' in error) {
            const status = (error as { status?: unknown }).status;
            if (typeof status === 'number') return status;
        }

        return 0;
    }

    private transitionToOpen() {
        this.state = CircuitState.OPEN;
        this.successes = 0;
        this.config.onStateChange?.(CircuitState.OPEN);
        console.warn('[CircuitBreaker] Circuit OPENED due to repeated failures');
    }

    private transitionToHalfOpen() {
        this.state = CircuitState.HALF_OPEN;
        this.successes = 0;
        this.config.onStateChange?.(CircuitState.HALF_OPEN);
        console.warn('[CircuitBreaker] Circuit HALF_OPEN - testing recovery');
    }

    private transitionToClosed() {
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        this.successes = 0;
        this.config.onStateChange?.(CircuitState.CLOSED);
        console.log('[CircuitBreaker] Circuit CLOSED - recovered');
    }

    reset(): void {
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        this.successes = 0;
        this.lastFailureTime = 0;
    }
}