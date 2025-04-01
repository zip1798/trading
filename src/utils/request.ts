import { ExchangeError, AuthenticationError, InvalidOrderError, InsufficientFundsError } from '../errors/ExchangeError';

export async function makeRequest(
    url: string,
    method: 'GET' | 'POST' | 'DELETE' | 'PUT',
    headers: Record<string, string>,
    body?: any
): Promise<any> {
    try {
        // For GET requests, append parameters to URL instead of using body
        let finalUrl = url;
        if (method === 'GET' && body) {
            const params = new URLSearchParams();
            Object.entries(body).forEach(([key, value]) => {
                params.append(key, String(value));
            });
            finalUrl = `${url}?${params.toString()}`;
        }

        const response = await fetch(finalUrl, {
            method,
            headers,
            // Only include body for non-GET requests
            body: method !== 'GET' ? JSON.stringify(body) : undefined
        });

        // Handle network errors
        if (!response.ok && response.status === 0) {
            throw new ExchangeError('Network error: Unable to reach server', 'NETWORK_ERROR');
        }

        let data;
        try {
            data = await response.json();
        } catch (error) {
            throw new ExchangeError('Invalid response format', 'INVALID_RESPONSE');
        }

        // Handle 404 errors specifically for orders
        if (response.status === 404) {
            if (url.includes('/orders/')) {
                throw new InvalidOrderError(data.error || 'Order not found');
            }
            throw new ExchangeError(data.error || 'Resource not found', 'NOT_FOUND');
        }

        // Handle authentication errors first
        if (response.status === 401 || data.code === 'AUTH_ERROR') {
            throw new AuthenticationError(data.error || 'Authentication failed');
        }

        // Handle specific error types based on response codes
        if (!response.ok || data.error) {
            switch (data.code) {
                case 'INVALID_ORDER':
                    throw new InvalidOrderError(data.error || 'Invalid order parameters');
                case 'INSUFFICIENT_FUNDS':
                    throw new InsufficientFundsError(data.error || 'Insufficient funds for the operation');
                case 'INVALID_SYMBOL':
                    throw new InvalidOrderError(data.error || 'Invalid trading symbol');
                case 'NOT_FOUND':
                    if (url.includes('/orders/')) {
                        throw new InvalidOrderError(data.error || 'Order not found');
                    }
                    throw new ExchangeError(data.error || 'Resource not found', 'NOT_FOUND');
                default:
                    throw new ExchangeError(
                        data.error || `HTTP error! status: ${response.status}`,
                        data.code || 'UNKNOWN_ERROR',
                        response.status
                    );
            }
        }

        return data;
    } catch (error) {
        // Re-throw specific error types
        if (error instanceof AuthenticationError || 
            error instanceof InvalidOrderError || 
            error instanceof InsufficientFundsError || 
            error instanceof ExchangeError) {
            throw error;
        }

        // Handle network or parsing errors
        throw new ExchangeError(
            error instanceof Error ? error.message : 'Network error',
            'NETWORK_ERROR',
            500
        );
    }
}