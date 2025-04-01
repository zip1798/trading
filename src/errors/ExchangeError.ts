export class ExchangeError extends Error {
    constructor(
        message: string,
        public readonly code?: string,
        public readonly httpStatus?: number
    ) {
        super(message);
        this.name = 'ExchangeError';
    }
}

export class AuthenticationError extends ExchangeError {
    constructor(message: string) {
        super(message, 'AUTH_ERROR', 401);
        this.name = 'AuthenticationError';
    }
}

export class InsufficientFundsError extends ExchangeError {
    constructor(message: string) {
        super(message, 'INSUFFICIENT_FUNDS', 400);
        this.name = 'InsufficientFundsError';
    }
}

export class InvalidOrderError extends ExchangeError {
    constructor(message: string) {
        super(message, 'INVALID_ORDER', 400);
        this.name = 'InvalidOrderError';
    }
}
