import { jest } from '@jest/globals';
import { enableFetchMocks } from 'jest-fetch-mock';
import { OrderParams } from '../src/types/exchange.types';

enableFetchMocks();

type ExchangeConfig = {
    prefix: string;
    field: string;
};

type ExchangeConfigs = {
    [key in 'paradex' | 'hyperliquid' | 'backpack']: ExchangeConfig;
};

beforeEach(() => {
    fetchMock.resetMocks();

    fetchMock.mockResponse(async (req) => {
        const baseResponse: ExchangeConfigs = {
            paradex: { prefix: 'X-', field: 'markets' },
            hyperliquid: { prefix: 'HL-', field: 'markets' },
            backpack: { prefix: 'BP-', field: 'markets' }
        };

        const exchangeType = Object.keys(baseResponse).find(ex =>
            req.url.toLowerCase().includes(ex)
        ) as keyof ExchangeConfigs || 'paradex';

        const { prefix } = baseResponse[exchangeType];

        // Common response headers
        const headers = {
            'Content-Type': 'application/json'
        };

        // Test invalid URL handling
        if (req.url.includes('invalid-url')) {
            return {
                status: 500,
                headers,
                body: JSON.stringify({
                    error: 'Failed to fetch',
                    code: 'NETWORK_ERROR'
                })
            };
        }

        // Authentication check for invalid API key
        if (req.headers.get(`${prefix}API-Key`) === 'invalid-key') {
            return {
                status: 401,
                headers,
                body: JSON.stringify({
                    error: 'Authentication failed',
                    code: 'AUTH_ERROR'
                })
            };
        }

        // API key check
        if (!req.headers.get(`${prefix}API-Key`)) {
            return {
                status: 401,
                headers,
                body: JSON.stringify({
                    error: 'Missing API key',
                    code: 'AUTH_ERROR'
                })
            };
        }

        // Signature check
        if (!req.headers.get(`${prefix}Signature`)) {
            return {
                status: 401,
                headers,
                body: JSON.stringify({
                    error: 'Invalid signature',
                    code: 'AUTH_ERROR'
                })
            };
        }

        // Handle order validation errors for POST and PUT requests
        if (req.url.includes('/orders') && (req.method === 'POST' || req.method === 'PUT')) {
            const requestBody = req.body ? JSON.parse(req.body.toString()) as Partial<OrderParams> : {};

            // Check for insufficient funds for large orders
            if (requestBody.quantity && requestBody.quantity >= 10) {
                return {
                    status: 400,
                    headers,
                    body: JSON.stringify({
                        error: 'Insufficient funds',
                        code: 'INSUFFICIENT_FUNDS'
                    })
                };
            }

            // Validate order parameters
            if (!requestBody.symbol || !requestBody.side || !requestBody.type ||
                !requestBody.quantity || requestBody.quantity <= 0 ||
                (requestBody.type === 'limit' && (!requestBody.price || requestBody.price <= 0))) {
                return {
                    status: 400,
                    headers,
                    body: JSON.stringify({
                        error: 'Invalid order parameters',
                        code: 'INVALID_ORDER'
                    })
                };
            }

            // For PUT requests (modify order), use the orderId from the URL
            const orderId = req.method === 'PUT' ? req.url.split('/').pop() : `test-order-${Date.now()}`;

            return {
                status: 200,
                headers,
                body: JSON.stringify({
                    orderId,
                    symbol: requestBody.symbol,
                    side: requestBody.side,
                    type: requestBody.type,
                    quantity: requestBody.quantity.toString(),
                    price: requestBody.type === 'market' ? undefined : requestBody.price?.toString() || '50000',
                    status: 'new',
                    filledQuantity: '0',
                    remainingQuantity: requestBody.quantity.toString(),
                    avgPrice: '0',
                    timestamp: Date.now(),
                    timeInForce: requestBody.timeInForce || 'GTC'
                })
            };
        }

        // Handle order history
        if (req.url.includes('/orders/history')) {
            const limit = Number(new URLSearchParams(req.url.split('?')[1]).get('limit')) || 50;
            const orders = Array.from({ length: Math.min(limit, 5) }, (_, i) => ({
                orderId: `test-order-history-${i + 1}`,
                symbol: 'BTC-USDT',
                side: 'buy',
                type: 'limit',
                quantity: '0.1',
                price: '50000',
                status: 'filled',
                filledQuantity: '0.1',
                remainingQuantity: '0',
                avgPrice: '50000',
                timestamp: Date.now() - (i * 3600000),
                timeInForce: 'GTC'
            }));

            return {
                status: 200,
                headers,
                body: JSON.stringify({ orders })
            };
        }

        // Handle specific order lookup
        if (req.url.includes('/orders/') && req.method === 'GET') {
            const orderId = req.url.split('/').pop();
            if (orderId === 'non-existent-id') {
                return {
                    status: 404,
                    headers,
                    body: JSON.stringify({
                        error: 'Order not found',
                        code: 'NOT_FOUND'
                    })
                };
            }

            return {
                status: 200,
                headers,
                body: JSON.stringify({
                    orderId,
                    symbol: 'BTC-USDT',
                    side: 'buy',
                    type: 'limit',
                    quantity: '0.1',
                    price: '50000',
                    status: 'new',
                    filledQuantity: '0',
                    remainingQuantity: '0.1',
                    avgPrice: '0',
                    timestamp: Date.now(),
                    timeInForce: 'GTC'
                })
            };
        }

        // Handle balances endpoint
        if (req.url.includes('/balances')) {
            return {
                status: 200,
                headers,
                body: JSON.stringify({
                    balances: [
                        {
                            asset: 'BTC',
                            free: '1.0',
                            locked: '0.1',
                            total: '1.1'
                        },
                        {
                            asset: 'USDT',
                            free: '5000.0',
                            locked: '1000.0',
                            total: '6000.0'
                        }
                    ]
                })
            };
        }

        // Handle other endpoints with their specific responses
        let responseBody;
        switch (true) {
            case req.url.includes('/markets'):
                responseBody = {
                    markets: [
                        {
                            symbol: 'BTC-USDT',
                            basePrecision: 8,
                            quotePrecision: 2,
                            minOrderSize: 0.0001,
                            maxOrderSize: 100
                        }
                    ]
                };
                break;

            case req.url.includes('/ticker'):
                if (!req.url.includes('BTC-USDT')) {
                    return {
                        status: 400,
                        headers,
                        body: JSON.stringify({
                            error: 'Invalid symbol',
                            code: 'INVALID_SYMBOL'
                        })
                    };
                }
                responseBody = {
                    symbol: 'BTC-USDT',
                    lastPrice: '50000',
                    bidPrice: '49900',
                    askPrice: '50100',
                    volume: '1000',
                    timestamp: Date.now()
                };
                break;

            case req.url.includes('/orders') && req.method === 'GET':
                if (req.url.includes('/orders/')) {
                    responseBody = {
                        orderId: req.url.split('/').pop(),
                        symbol: 'BTC-USDT',
                        side: 'buy',
                        type: 'limit',
                        quantity: '0.1',
                        price: '50000',
                        status: 'new',
                        filledQuantity: '0',
                        remainingQuantity: '0.1',
                        avgPrice: '0',
                        timestamp: Date.now(),
                        timeInForce: 'GTC'
                    };
                } else {
                    responseBody = { orders: [] };
                }
                break;

            case req.url.includes('/orders') && req.method === 'DELETE':
                responseBody = { success: true };
                break;

            default:
                responseBody = {};
        }

        return {
            status: 200,
            headers,
            body: JSON.stringify(responseBody)
        };
    });
});