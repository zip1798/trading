import { Balance, MarketInfo, Order, OrderParams, Ticker } from '../types/exchange.types';

export interface IExchange {
    // Market Data
    getMarkets(): Promise<MarketInfo[]>;
    getTicker(symbol: string): Promise<Ticker>;
    getCurrentPrice(symbol: string): Promise<number>;

    // Account Information
    getBalances(): Promise<Balance[]>;
    getBalance(asset: string): Promise<Balance>;

    // Trading
    createOrder(params: OrderParams): Promise<Order>;
    modifyOrder(symbol: string, orderId: string, params: Partial<OrderParams>): Promise<Order>;
    cancelOrder(symbol: string, orderId: string): Promise<boolean>;
    getOrder(symbol: string, orderId: string): Promise<Order>;
    getOpenOrders(symbol?: string): Promise<Order[]>;
    getOrderHistory(symbol?: string, limit?: number): Promise<Order[]>;

    // Additional Methods
    withdraw(asset: string, address: string, amount: number): Promise<string>;
    getDepositAddress(asset: string): Promise<string>;
}