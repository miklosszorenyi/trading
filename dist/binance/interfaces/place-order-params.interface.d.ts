export interface PlaceOrderParams {
    symbol: string;
    side: string;
    type: string;
    stopPrice: number;
    closePosition?: boolean;
    quantity?: number;
}
