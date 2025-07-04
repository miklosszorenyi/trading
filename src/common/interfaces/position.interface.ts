export interface Position {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  orderId: number;
  stopLossOrderId?: number;
  takeProfitOrderId?: number;
  status: 'PENDING' | 'FILLED' | 'CLOSED';
  createdAt: Date;
  filledAt?: Date;
}