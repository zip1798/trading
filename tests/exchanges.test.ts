import { jest } from '@jest/globals';
import { Paradex } from '../src/exchanges/Paradex';
import { Hyperliquid } from '../src/exchanges/Hyperliquid';
import { Backpack } from '../src/exchanges/Backpack';
import { OrderParams, OrderSide, OrderType } from '../src/types/exchange.types';
import { ExchangeError, AuthenticationError, InvalidOrderError, InsufficientFundsError } from '../src/errors/ExchangeError';

describe('Exchange Integration Tests', () => {
    const exchanges = [
        new Paradex('test-api-key', 'test-api-secret'),
        new Hyperliquid('test-api-key', 'test-api-secret'),
        new Backpack('test-api-key', 'test-api-secret')
    ];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    exchanges.forEach(exchange => {
        describe(`${exchange.constructor.name}`, () => {
            describe('Market Data', () => {
                it('should get markets', async () => {
                    const markets = await exchange.getMarkets();
                    expect(Array.isArray(markets)).toBeTruthy();
                    expect(markets.length).toBeGreaterThan(0);
                    expect(markets[0]).toHaveProperty('symbol');
                    expect(markets[0]).toHaveProperty('basePrecision');
                    expect(markets[0]).toHaveProperty('quotePrecision');
                });

                it('should get ticker', async () => {
                    const ticker = await exchange.getTicker('BTC-USDT');
                    expect(ticker).toHaveProperty('lastPrice');
                    expect(ticker).toHaveProperty('bidPrice');
                    expect(ticker).toHaveProperty('askPrice');
                    expect(ticker).toHaveProperty('volume24h');
                    expect(ticker).toHaveProperty('timestamp');
                });

                it('should throw error for empty symbol in getTicker', async () => {
                    await expect(exchange.getTicker('')).rejects.toThrow(InvalidOrderError);
                });

                it('should throw error for invalid symbol in getTicker', async () => {
                    await expect(exchange.getTicker('INVALID-PAIR')).rejects.toThrow(ExchangeError);
                });

                it('should get current price for symbol', async () => {
                    const price = await exchange.getCurrentPrice('BTC-USDT');
                    expect(typeof price).toBe('number');
                    expect(price).toBeGreaterThan(0);
                });

                it('should throw error for invalid symbol in getCurrentPrice', async () => {
                    await expect(exchange.getCurrentPrice('INVALID-PAIR'))
                        .rejects
                        .toThrow(ExchangeError);
                });
            });

            describe('Account Information', () => {
                it('should get all balances', async () => {
                    const balances = await exchange.getBalances();
                    expect(Array.isArray(balances)).toBeTruthy();
                    expect(balances[0]).toHaveProperty('asset');
                    expect(balances[0]).toHaveProperty('free');
                    expect(balances[0]).toHaveProperty('locked');
                    expect(balances[0]).toHaveProperty('total');
                });

                it('should get specific asset balance', async () => {
                    const balance = await exchange.getBalance('BTC');
                    expect(balance.asset).toBe('BTC');
                    expect(typeof balance.free).toBe('number');
                    expect(typeof balance.locked).toBe('number');
                    expect(typeof balance.total).toBe('number');
                });

                it('should throw error for non-existent asset', async () => {
                    await expect(exchange.getBalance('INVALID')).rejects.toThrow(ExchangeError);
                });
            });

            describe('Order Management', () => {
                describe('Limit Orders', () => {
                    const validLimitOrderParams: OrderParams = {
                        symbol: 'BTC-USDT',
                        side: 'buy' as OrderSide,
                        type: 'limit' as OrderType,
                        quantity: 0.1,
                        price: 50000,
                        timeInForce: 'GTC'
                    };

                    it('should create and cancel limit order', async () => {
                        console.log('Creating limit order with params:', validLimitOrderParams);
                        const order = await exchange.createOrder(validLimitOrderParams);

                        expect(order).toHaveProperty('orderId');
                        expect(order.status).toBe('new');
                        expect(order.symbol).toBe(validLimitOrderParams.symbol);
                        expect(order.side).toBe(validLimitOrderParams.side);
                        expect(order.type).toBe(validLimitOrderParams.type);
                        expect(order.price).toBe(validLimitOrderParams.price);

                        const canceled = await exchange.cancelOrder(order.symbol, order.orderId);
                        expect(canceled).toBeTruthy();
                    });

                    it('should reject limit order without price', async () => {
                        const invalidOrder: OrderParams = {
                            ...validLimitOrderParams,
                            price: undefined
                        };

                        await expect(exchange.createOrder(invalidOrder))
                            .rejects
                            .toThrow('Price is required for limit orders and must be greater than 0');
                    });

                    it('should reject limit order with zero price', async () => {
                        const invalidOrder: OrderParams = {
                            ...validLimitOrderParams,
                            price: 0
                        };

                        await expect(exchange.createOrder(invalidOrder))
                            .rejects
                            .toThrow('Price is required for limit orders and must be greater than 0');
                    });

                    it('should validate quantity is greater than zero', async () => {
                        const invalidOrder: OrderParams = {
                            ...validLimitOrderParams,
                            quantity: 0
                        };

                        await expect(exchange.createOrder(invalidOrder))
                            .rejects
                            .toThrow('Quantity must be greater than 0');
                    });
                });

                describe('Market Orders', () => {
                    const validMarketOrderParams: OrderParams = {
                        symbol: 'BTC-USDT',
                        side: 'buy' as OrderSide,
                        type: 'market' as OrderType,
                        quantity: 0.1
                    };

                    it('should create market order successfully', async () => {
                        const order = await exchange.createOrder(validMarketOrderParams);
                        expect(order.status).toBe('new');
                        expect(order.type).toBe('market');
                        expect(order.price).toBeUndefined();
                    });

                    it('should reject market order with invalid quantity', async () => {
                        const invalidOrder: OrderParams = {
                            ...validMarketOrderParams,
                            quantity: 0
                        };

                        await expect(exchange.createOrder(invalidOrder))
                            .rejects
                            .toThrow('Quantity must be greater than 0');
                    });
                });

                describe('Order History', () => {
                    it('should fetch order history', async () => {
                        const history = await exchange.getOrderHistory('BTC-USDT');
                        expect(Array.isArray(history)).toBeTruthy();
                        if (history.length > 0) {
                            expect(history[0]).toHaveProperty('orderId');
                            expect(history[0]).toHaveProperty('status');
                        }
                    });

                    it('should respect history limit parameter', async () => {
                        const limit = 5;
                        const history = await exchange.getOrderHistory('BTC-USDT', limit);
                        expect(history.length).toBeLessThanOrEqual(limit);
                    });
                });

                describe('Order Modification', () => {
                    it('should modify limit order', async () => {
                        const order = await exchange.createOrder({
                            symbol: 'BTC-USDT',
                            side: 'buy' as OrderSide,
                            type: 'limit' as OrderType,
                            quantity: 0.1,
                            price: 50000,
                            timeInForce: 'GTC'
                        });

                        const newQuantity = 0.2;
                        const modifiedOrder = await exchange.modifyOrder(
                            order.symbol,
                            order.orderId,
                            { quantity: newQuantity }
                        );

                        expect(modifiedOrder.orderId).toBe(order.orderId);
                        expect(modifiedOrder.quantity).toBe(newQuantity);
                    });

                    it('should validate modified order parameters', async () => {
                        const order = await exchange.createOrder({
                            symbol: 'BTC-USDT',
                            side: 'buy' as OrderSide,
                            type: 'limit' as OrderType,
                            quantity: 0.1,
                            price: 50000,
                            timeInForce: 'GTC'
                        });

                        await expect(exchange.modifyOrder(
                            order.symbol,
                            order.orderId,
                            { quantity: -1 }
                        )).rejects.toThrow('Quantity must be greater than 0');
                    });
                });

                describe('Order Closing', () => {
                    it('should close order at market price', async () => {
                        // Create initial order
                        const order = await exchange.createOrder({
                            symbol: 'BTC-USDT',
                            side: 'buy' as OrderSide,
                            type: 'limit' as OrderType,
                            quantity: 0.1,
                            price: 50000,
                            timeInForce: 'GTC'
                        });

                        const closedOrder = await exchange.closeOrderMarket(order.symbol, order.orderId);
                        expect(closedOrder.side).toBe('sell');
                        expect(closedOrder.type).toBe('market');
                        expect(closedOrder.quantity).toBe(order.remainingQuantity);
                    });

                    it('should close order at limit price', async () => {
                        // Create initial order
                        const order = await exchange.createOrder({
                            symbol: 'BTC-USDT',
                            side: 'buy' as OrderSide,
                            type: 'limit' as OrderType,
                            quantity: 0.1,
                            price: 50000,
                            timeInForce: 'GTC'
                        });

                        const closePrice = 51000;
                        const closedOrder = await exchange.closeOrderLimit(order.symbol, order.orderId, closePrice);
                        expect(closedOrder.side).toBe('sell');
                        expect(closedOrder.type).toBe('limit');
                        expect(closedOrder.quantity).toBe(order.remainingQuantity);
                        expect(closedOrder.price).toBe(closePrice);
                    });

                    it('should throw error when closing non-existent order', async () => {
                        await expect(exchange.closeOrderMarket('BTC-USDT', 'non-existent-id'))
                            .rejects
                            .toThrow(InvalidOrderError);

                        await expect(exchange.closeOrderLimit('BTC-USDT', 'non-existent-id', 50000))
                            .rejects
                            .toThrow(InvalidOrderError);
                    });
                });

                it('should handle insufficient funds error', async () => {
                    const largeOrderParams: OrderParams = {
                        symbol: 'BTC-USDT',
                        side: 'buy' as OrderSide,
                        type: 'limit' as OrderType,
                        quantity: 10000,
                        price: 50000,
                        timeInForce: 'GTC'
                    };

                    await expect(exchange.createOrder(largeOrderParams))
                        .rejects
                        .toThrow(InsufficientFundsError);
                });
            });

            describe('Error Handling', () => {
                it('should handle authentication errors', async () => {
                    const invalidExchange = new (exchange.constructor as any)('invalid-key', 'invalid-secret');
                    await expect(invalidExchange.getBalances()).rejects.toThrow(AuthenticationError);
                });

                it('should handle network errors gracefully', async () => {
                    const invalidExchange = new (exchange.constructor as any)('test-key', 'test-secret', 'https://invalid-url');
                    await expect(invalidExchange.getMarkets()).rejects.toThrow(ExchangeError);
                });

                it('should handle API errors with proper status codes', async () => {
                    await expect(exchange.getTicker('INVALID-PAIR')).rejects.toThrow(ExchangeError);
                });
            });
        });
    });
});