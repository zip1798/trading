import { BaseExchange } from '../base/BaseExchange';
import { Balance, MarketInfo, Order, OrderParams, Ticker } from '../types/exchange.types';
import { makeRequest } from '../utils/request';
import { ExchangeError, AuthenticationError } from '../errors/ExchangeError';
import * as crypto from 'crypto';

export class Hyperliquid extends BaseExchange {
    constructor(
        apiKey: string,
        apiSecret: string,
        baseUrl: string = 'https://api.hyperliquid.io/v1'
    ) {
        super(apiKey, apiSecret, baseUrl);
    }

    protected signRequest(path: string, params: any = {}): string {
        const timestamp = Date.now().toString();
        const message = `${timestamp}${path}${JSON.stringify(params)}`;
        return crypto.createHmac('sha256', this.apiSecret)
            .update(message)
            .digest('hex');
    }

    private getHeaders(path: string = '', params: any = {}): Record<string, string> {
        const timestamp = Date.now().toString();
        return {
            'HL-API-Key': this.apiKey,
            'HL-Timestamp': timestamp,
            'HL-Signature': this.signRequest(path, params),
            'Content-Type': 'application/json'
        };
    }

    async getMarkets(): Promise<MarketInfo[]> {
        try {
            const response = await makeRequest(
                `${this.baseUrl}/markets`,
                'GET',
                this.getHeaders('/markets')
            );
            return response.markets.map(this.transformMarketInfo);
        } catch (error) {
            throw this.handleError(error, 'Failed to fetch markets');
        }
    }

    async getTicker(symbol: string): Promise<Ticker> {
        try {
            const path = `/ticker/${symbol}`;
            const response = await makeRequest(
                `${this.baseUrl}${path}`,
                'GET',
                this.getHeaders(path)
            );
            return this.transformTicker(response);
        } catch (error) {
            throw this.handleError(error, 'Failed to fetch ticker');
        }
    }

    async getBalances(): Promise<Balance[]> {
        try {
            const response = await makeRequest(
                `${this.baseUrl}/balances`,
                'GET',
                this.getHeaders('/balances')
            );
            return response.balances.map(this.transformBalance);
        } catch (error) {
            throw this.handleError(error, 'Failed to fetch balances');
        }
    }

    async createOrder(params: OrderParams): Promise<Order> {
        await this.validateOrder(params);

        try {
            const path = '/orders';
            const response = await makeRequest(
                `${this.baseUrl}${path}`,
                'POST',
                this.getHeaders(path, params),
                params
            );
            return this.transformOrder(response);
        } catch (error) {
            throw this.handleError(error, 'Failed to create order');
        }
    }

    async modifyOrder(symbol: string, orderId: string, params: Partial<OrderParams>): Promise<Order> {
        try {
            const path = `/orders/${orderId}`;
            const existingOrder = await this.getOrder(symbol, orderId);

            const updatedParams = {
                ...existingOrder,
                ...params,
                symbol: existingOrder.symbol,
                side: existingOrder.side,
                type: existingOrder.type
            };

            await this.validateOrder(updatedParams, { skipBalanceCheck: true });

            const response = await makeRequest(
                `${this.baseUrl}${path}`,
                'PUT',
                this.getHeaders(path, updatedParams),
                updatedParams
            );
            return this.transformOrder(response);
        } catch (error) {
            throw this.handleError(error, 'Failed to modify order');
        }
    }

    async getOrderHistory(symbol?: string, limit: number = 50): Promise<Order[]> {
        try {
            const path = '/orders/history';
            const params = { symbol, limit };
            const response = await makeRequest(
                `${this.baseUrl}${path}`,
                'GET',
                this.getHeaders(path, params),
                params
            );
            return response.orders.map(this.transformOrder);
        } catch (error) {
            throw this.handleError(error, 'Failed to fetch order history');
        }
    }

    async cancelOrder(symbol: string, orderId: string): Promise<boolean> {
        try {
            const path = `/orders/${orderId}`;
            await makeRequest(
                `${this.baseUrl}${path}`,
                'DELETE',
                this.getHeaders(path)
            );
            return true;
        } catch (error) {
            throw this.handleError(error, 'Failed to cancel order');
        }
    }

    async getOrder(symbol: string, orderId: string): Promise<Order> {
        try {
            const path = `/orders/${orderId}`;
            const response = await makeRequest(
                `${this.baseUrl}${path}`,
                'GET',
                this.getHeaders(path)
            );
            return this.transformOrder(response);
        } catch (error) {
            throw this.handleError(error, 'Failed to fetch order');
        }
    }

    async getOpenOrders(symbol?: string): Promise<Order[]> {
        try {
            const path = '/orders';
            const params = symbol ? { symbol } : {};
            const response = await makeRequest(
                `${this.baseUrl}${path}`,
                'GET',
                this.getHeaders(path, params),
                params
            );
            return response.orders.map(this.transformOrder);
        } catch (error) {
            throw this.handleError(error, 'Failed to fetch open orders');
        }
    }

    async withdraw(asset: string, address: string, amount: number): Promise<string> {
        try {
            const path = '/withdraw';
            const params = { asset, address, amount };
            const response = await makeRequest(
                `${this.baseUrl}${path}`,
                'POST',
                this.getHeaders(path, params),
                params
            );
            return response.withdrawalId;
        } catch (error) {
            throw this.handleError(error, 'Failed to withdraw');
        }
    }

    async getDepositAddress(asset: string): Promise<string> {
        try {
            const path = `/deposit-address/${asset}`;
            const response = await makeRequest(
                `${this.baseUrl}${path}`,
                'GET',
                this.getHeaders(path)
            );
            return response.address;
        } catch (error) {
            throw this.handleError(error, 'Failed to get deposit address');
        }
    }

    private transformMarketInfo(market: any): MarketInfo {
        return {
            symbol: market.symbol,
            basePrecision: market.basePrecision,
            quotePrecision: market.quotePrecision,
            minOrderSize: market.minOrderSize,
            maxOrderSize: market.maxOrderSize
        };
    }

    private transformTicker(ticker: any): Ticker {
        return {
            symbol: ticker.symbol,
            lastPrice: parseFloat(ticker.lastPrice),
            bidPrice: parseFloat(ticker.bidPrice),
            askPrice: parseFloat(ticker.askPrice),
            volume24h: parseFloat(ticker.volume),
            timestamp: ticker.timestamp
        };
    }

    private transformBalance(balance: any): Balance {
        return {
            asset: balance.asset,
            free: parseFloat(balance.available),
            locked: parseFloat(balance.locked),
            total: parseFloat(balance.total)
        };
    }

    private transformOrder(order: any): Order {
        return {
            orderId: order.orderId,
            symbol: order.symbol,
            side: order.side.toLowerCase(),
            type: order.type.toLowerCase(),
            quantity: parseFloat(order.quantity),
            price: order.type.toLowerCase() === 'market' ? undefined : parseFloat(order.price || '0'),
            status: order.status.toLowerCase(),
            filledQuantity: parseFloat(order.filledQuantity),
            remainingQuantity: parseFloat(order.remainingQuantity),
            avgPrice: parseFloat(order.avgPrice || '0'),
            timestamp: order.timestamp,
            timeInForce: (order.timeInForce || 'GTC').toUpperCase()
        };
    }
}