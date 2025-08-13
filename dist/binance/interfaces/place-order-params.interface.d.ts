import { OrderType } from "src/trading/interfaces/trading.interface";
export interface PlaceOrderParams {
    symbol: string;
    side: string;
    type: OrderType;
    stopPrice: number;
    closePosition?: boolean;
    quantity?: number;
}
