import { OrderSide, OrderType } from 'src/trading/interfaces/trading.interface';

export interface PlaceOrderParams {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity?: number;
  stopPrice?: number;
}

export interface PlaceOrderParamsDTO extends PlaceOrderParams {
  closePosition?: boolean;
  workingType?: string;
}
