export interface PositionDTO {
  entryPrice: string;
  breakEvenPrice: string;
  marginType: string;
  isAutoAddMargin: string;
  isolatedMargin: string;
  leverage: string;
  liquidationPrice: string;
  markPrice: string;
  maxNotionalValue: string;
  positionAmt: string;
  notional: string;
  isolatedWallet: string;
  symbol: string;
  unRealizedProfit: string;
  positionSide: string;
  updateTime: number;
}

export interface OrderDTO {
  orderId: number;
  symbol: string;
  status: string; // 'NEW';
  clientOrderId: string;
  price: string;
  avgPrice: string;
  origQty: string;
  executedQty: string;
  cumQuote: string;
  timeInForce: string;
  type: string;
  reduceOnly: boolean;
  closePosition: boolean;
  side: string;
  positionSide: string;
  stopPrice: string;
  workingType: string;
  priceProtect: boolean;
  origType: string;
  priceMatch: string;
  selfTradePreventionMode: string;
  goodTillDate: string;
  time: number;
  updateTime: number;
}

export interface Position {
  // id: string;
  // side: 'BUY' | 'SELL';
  entryPrice: number;
  breakEvenPrice: number;
  marginType: string;
  isAutoAddMargin: boolean;
  isolatedMargin: number;
  leverage: number;
  liquidationPrice: number;
  markPrice: number;
  maxNotionalValue: number;
  positionAmt: number;
  notional: number;
  isolatedWallet: number;
  symbol: string;
  unRealizedProfit: number;
  positionSide: string;
  updateTime: number;
}

export interface Order {
  orderId: number;
  symbol: string;
  status: string;
  clientOrderId: string;
  price: number;
  avgPrice: number;
  origQty: number;
  executedQty: number;
  cumQuote: number;
  timeInForce: string;
  type: string;
  reduceOnly: boolean;
  closePosition: boolean;
  side: string;
  positionSide: string;
  stopPrice: string;
  workingType: string;
  priceProtect: boolean;
  origType: string;
  priceMatch: string;
  selfTradePreventionMode: string;
  goodTillDate: number;
  time: number;
  updateTime: number;
}

export interface RequestedOrder {
  orderId?: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  low: number;
  high: number;
  requestTime: Date;
}

export interface PositionInfo {
  openOrders: Order[];
  activePositions: Position[];
  requestedOrders: RequestedOrder[];
}

export enum OrderType {
  STOP_MARKET = "STOP_MARKET",
  LIMIT = "LIMIT",
  TAKE_PROFIT_MARKET = "TAKE_PROFIT_MARKET",
  TAKE_PROFIT_LIMIT = "TAKE_PROFIT_LIMIT",
}
