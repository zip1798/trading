import { Balance, MarketInfo, Order, OrderParams, Ticker } from '../types/exchange.types';
import { ExchangeError, AuthenticationError, InvalidOrderError, InsufficientFundsError } from '../errors/ExchangeError';

export abstract class BaseExchange {
    constructor(
        protected readonly apiKey: string,
        protected readonly apiSecret: string,
        protected readonly baseUrl: string
    ) {
        if (!apiKey || !apiSecret) {
            throw new AuthenticationError('API key and secret are required');
        }
    }

    protected abstract signRequest(path: string, params: any): string;

    abstract getMarkets(): Promise<MarketInfo[]>;
    abstract getTicker(symbol: string): Promise<Ticker>;
    abstract getBalances(): Promise<Balance[]>;
    abstract createOrder(params: OrderParams): Promise<Order>;
    abstract getOrder(symbol: string, orderId: string): Promise<Order>;
    abstract cancelOrder(symbol: string, orderId: string): Promise<boolean>;
    abstract getOpenOrders(symbol?: string): Promise<Order[]>;
    abstract getOrderHistory(symbol?: string, limit?: number): Promise<Order[]>;

    // Required abstract methods for exchange-specific operations
    abstract withdraw(asset: string, address: string, amount: number): Promise<string>;
    abstract getDepositAddress(asset: string): Promise<string>;
    abstract modifyOrder(symbol: string, orderId: string, params: Partial<OrderParams>): Promise<Order>;

    // Order closing methods
    async closeOrderMarket(symbol: string, orderId: string): Promise<Order> {
        try {
            const order = await this.getOrder(symbol, orderId);
            if (!order || !order.orderId) {
                throw new InvalidOrderError('Order not found');
            }

            await this.cancelOrder(symbol, orderId);

            const closeParams: OrderParams = {
                symbol: order.symbol,
                side: order.side === 'buy' ? 'sell' : 'buy', // Reverse the side to close
                type: 'market',
                quantity: order.remainingQuantity,
            };

            return this.createOrder(closeParams);
        } catch (error) {
            if (error instanceof InvalidOrderError) {
                throw error;
            }
            throw this.handleError(error, 'Failed to close order at market price');
        }
    }

    async closeOrderLimit(symbol: string, orderId: string, price: number): Promise<Order> {
        try {
            const order = await this.getOrder(symbol, orderId);
            if (!order || !order.orderId) {
                throw new InvalidOrderError('Order not found');
            }

            await this.cancelOrder(symbol, orderId);

            const closeParams: OrderParams = {
                symbol: order.symbol,
                side: order.side === 'buy' ? 'sell' : 'buy', // Reverse the side to close
                type: 'limit',
                quantity: order.remainingQuantity,
                price: price,
                timeInForce: 'GTC'
            };

            return this.createOrder(closeParams);
        } catch (error) {
            if (error instanceof InvalidOrderError) {
                throw error;
            }
            throw this.handleError(error, 'Failed to close order at limit price');
        }
    }

    // Protected validation methods
    protected async validateOrder(params: OrderParams, options: { skipBalanceCheck?: boolean } = {}): Promise<void> {
        // Basic field validations
        if (!params.symbol) throw new InvalidOrderError('Symbol is required');
        if (!params.side) throw new InvalidOrderError('Side is required');
        if (!params.type) throw new InvalidOrderError('Type is required');
        if (!params.quantity || params.quantity <= 0) throw new InvalidOrderError('Quantity must be greater than 0');

        if (!['buy', 'sell'].includes(params.side.toLowerCase())) {
            throw new InvalidOrderError('Invalid side');
        }

        if (!['market', 'limit'].includes(params.type.toLowerCase())) {
            throw new InvalidOrderError('Invalid type');
        }

        // Limit order price validation
        if (params.type.toLowerCase() === 'limit') {
            if (!params.price || params.price <= 0) {
                throw new InvalidOrderError('Price is required for limit orders and must be greater than 0');
            }
        }

        // Balance check (skip for order modifications)
        if (!options.skipBalanceCheck) {
            try {
                const [baseAsset, quoteAsset] = params.symbol.split('-');
                const asset = params.side === 'buy' ? quoteAsset : baseAsset;
                const balance = await this.getBalance(asset);

                const currentPrice = params.type === 'market' || !params.price 
                    ? await this.getCurrentPrice(params.symbol)
                    : params.price;

                const requiredAmount = params.side === 'buy'
                    ? params.quantity * currentPrice
                    : params.quantity;

                if (balance.free < requiredAmount) {
                    throw new InsufficientFundsError(
                        `Insufficient ${asset} balance. Required: ${requiredAmount}, Available: ${balance.free}`
                    );
                }
            } catch (error) {
                if (error instanceof InsufficientFundsError) {
                    throw error;
                }
                throw this.handleError(error, 'Failed to validate balance');
            }
        }
    }

    protected handleError(error: unknown, defaultMessage: string): never {
        if (error instanceof Error) {
            // Handle specific error types
            if (error instanceof AuthenticationError ||
                error instanceof InvalidOrderError ||
                error instanceof InsufficientFundsError ||
                error instanceof ExchangeError) {
                throw error;
            }

            // Map error codes to specific error types
            if ('code' in error) {
                const errorWithCode = error as Error & { code: string };
                switch (errorWithCode.code) {
                    case 'AUTH_ERROR':
                        throw new AuthenticationError(error.message || 'Authentication failed');
                    case 'INVALID_ORDER':
                        throw new InvalidOrderError(error.message || 'Invalid order parameters');
                    case 'INSUFFICIENT_FUNDS':
                        throw new InsufficientFundsError(error.message || 'Insufficient funds');
                    case 'NOT_FOUND':
                        throw new InvalidOrderError(error.message || 'Order not found');
                    default:
                        throw new ExchangeError(error.message || defaultMessage, errorWithCode.code);
                }
            }

            throw new ExchangeError(error.message || defaultMessage);
        }
        throw new ExchangeError(defaultMessage);
    }

    // Common utility methods
    async getCurrentPrice(symbol: string): Promise<number> {
        try {
            const ticker = await this.getTicker(symbol);
            return ticker.lastPrice;
        } catch (error) {
            throw this.handleError(error, `Failed to get current price for ${symbol}`);
        }
    }

    async getBalance(asset: string): Promise<Balance> {
        try {
            const balances = await this.getBalances();
            const balance = balances.find(b => b.asset === asset);
            if (!balance) {
                throw new InvalidOrderError(`Balance not found for asset ${asset}`);
            }
            return balance;
        } catch (error) {
            throw this.handleError(error, `Failed to get balance for ${asset}`);
        }
    }
}