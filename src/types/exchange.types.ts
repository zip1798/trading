export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';
export type TimeInForce = 'GTC' | 'IOC' | 'FOK';

export interface OrderParams {
    symbol: string;
    side: OrderSide;
    type: OrderType;
    quantity: number;
    price?: number;
    timeInForce?: TimeInForce;
}

export interface Order extends OrderParams {
    orderId: string;
    status: OrderStatus;
    filledQuantity: number;
    remainingQuantity: number;
    avgPrice: number;
    timestamp: number;
}

export type OrderStatus = 'new' | 'partially_filled' | 'filled' | 'canceled' | 'rejected';

export interface Balance {
    asset: string;
    free: number;
    locked: number;
    total: number;
}

export interface MarketInfo {
    symbol: string;
    basePrecision: number;
    quotePrecision: number;
    minOrderSize: number;
    maxOrderSize: number;
}

export interface Ticker {
    symbol: string;
    lastPrice: number;
    bidPrice: number;
    askPrice: number;
    volume24h: number;
    timestamp: number;
}
