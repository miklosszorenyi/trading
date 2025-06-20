import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BinanceService } from '../binance/binance.service';
import { TradingViewWebhookDto } from '../common/dto/tradingview-webhook.dto';
import { Position } from '../common/interfaces/position.interface';

@Injectable()
export class TradingService implements OnModuleInit {
  private readonly logger = new Logger(TradingService.name);
  private positions: Map<string, Position> = new Map();
  private readonly maxPositionPercentage: number;

  constructor(
    private binanceService: BinanceService,
    private configService: ConfigService,
  ) {
    this.maxPositionPercentage = this.configService.get<number>('MAX_POSITION_PERCENTAGE', 2);
  }

  onModuleInit() {
    // Set up order update callback
    this.binanceService.setOrderUpdateCallback((data) => {
      this.handleOrderUpdate(data);
    });

    this.logger.log(`🎯 Trading service initialized with ${this.maxPositionPercentage}% max position size`);
  }

  async processTradingSignal(signal: TradingViewWebhookDto): Promise<void> {
    try {
      this.logger.log(`🔄 Processing ${signal.type} signal for ${signal.symbol}`);

      // Calculate position size
      const quantity = await this.calculatePositionSize(signal.symbol);
      if (!quantity) {
        throw new Error('Unable to calculate position size');
      }

      // Get current price for stop price calculation
      const currentPrice = await this.binanceService.getSymbolPrice(signal.symbol);
      
      // Calculate stop price based on signal direction
      let stopPrice: number;
      if (signal.type === 'BUY') {
        // For BUY signals, use a stop price slightly above current price
        stopPrice = currentPrice * 1.001; // 0.1% above current price
      } else {
        // For SELL signals, use a stop price slightly below current price
        stopPrice = currentPrice * 0.999; // 0.1% below current price
      }

      // Create position record
      const positionId = `${signal.symbol}_${Date.now()}`;
      const position: Position = {
        id: positionId,
        symbol: signal.symbol,
        side: signal.type,
        quantity,
        entryPrice: 0, // Will be updated when order fills
        stopLoss: signal.low,
        takeProfit: signal.high,
        orderId: 0, // Will be updated after order placement
        status: 'PENDING',
        createdAt: new Date(),
      };

      // Place stop market order
      const order = await this.binanceService.placeMarketOrder(
        signal.symbol,
        signal.type,
        quantity,
        stopPrice
      );

      position.orderId = order.orderId;
      this.positions.set(positionId, position);

      this.logger.log(`📈 Position created: ${positionId} - ${signal.type} ${quantity} ${signal.symbol} at stop price ${stopPrice}`);
    } catch (error) {
      this.logger.error('❌ Failed to process trading signal', error);
      throw error;
    }
  }

  async getOrdersAndPositions() {
    try {
      // Memóriában tárolt pozíciók (TradingView signalokból)
      const managedPositions = this.getActivePositions();
      
      // Binance API-ból lekért adatok
      const [openOrders, activePositions] = await Promise.all([
        this.binanceService.getOpenOrders(),
        this.binanceService.getPositions()
      ]);

      return {
        managedPositions,
        openOrders,
        activePositions
      };
    } catch (error) {
      this.logger.error('❌ Failed to get orders and positions', error);
      throw error;
    }
  }

  private async calculatePositionSize(symbol: string): Promise<number | null> {
    try {
      // Get account balance
      const balances = await this.binanceService.getAccountBalance();
      const usdtBalance = balances.find(b => b.asset === 'USDT');
      
      if (!usdtBalance || parseFloat(usdtBalance.walletBalance) <= 0) {
        this.logger.error('❌ Insufficient USDT balance');
        return null;
      }

      const availableBalance = parseFloat(usdtBalance.walletBalance);
      const maxPositionValue = (availableBalance * this.maxPositionPercentage) / 100;

      // Get current price
      const currentPrice = await this.binanceService.getSymbolPrice(symbol);
      
      // Get symbol info for precision
      const symbolInfo = await this.binanceService.getSymbolInfo(symbol);
      const stepSize = parseFloat(symbolInfo.filters.find(f => f.filterType === 'LOT_SIZE').stepSize);
      
      // Calculate quantity
      let quantity = maxPositionValue / currentPrice;
      
      // Round to step size
      quantity = Math.floor(quantity / stepSize) * stepSize;
      
      // Ensure minimum quantity
      const minQty = parseFloat(symbolInfo.filters.find(f => f.filterType === 'LOT_SIZE').minQty);
      if (quantity < minQty) {
        this.logger.error(`❌ Calculated quantity ${quantity} is below minimum ${minQty}`);
        return null;
      }

      this.logger.log(`💰 Position size calculated: ${quantity} ${symbol} (${maxPositionValue} USDT at ${currentPrice})`);
      return parseFloat(quantity.toFixed(8));
    } catch (error) {
      this.logger.error('❌ Failed to calculate position size', error);
      return null;
    }
  }

  private async handleOrderUpdate(data: any): Promise<void> {
    try {
      const orderId = data.i;
      const symbol = data.s;
      const status = data.X; // Order status
      const side = data.S;
      const executedQty = parseFloat(data.z);
      const avgPrice = parseFloat(data.Z) / executedQty || 0;

      this.logger.log(`📊 Order update: ${symbol} ${side} ${status} - OrderId: ${orderId}`);

      // Find position by order ID
      const position = Array.from(this.positions.values()).find(p => 
        p.orderId === orderId || 
        p.stopLossOrderId === orderId || 
        p.takeProfitOrderId === orderId
      );

      if (!position) {
        this.logger.debug(`🔍 No position found for order ${orderId}`);
        return;
      }

      // Handle initial stop market order fill
      if (position.orderId === orderId && status === 'FILLED' && position.status === 'PENDING') {
        position.status = 'FILLED';
        position.entryPrice = avgPrice;
        position.filledAt = new Date();

        this.logger.log(`✅ Position filled: ${position.id} at ${avgPrice}`);

        // Place SL and TP orders
        await this.placeSLTPOrders(position);
      }

      // Handle SL/TP order fills
      if ((position.stopLossOrderId === orderId || position.takeProfitOrderId === orderId) && status === 'FILLED') {
        position.status = 'CLOSED';
        
        const orderType = position.stopLossOrderId === orderId ? 'Stop Loss' : 'Take Profit';
        this.logger.log(`🎯 ${orderType} executed for position ${position.id}`);

        // Cancel the other pending order
        if (position.stopLossOrderId === orderId && position.takeProfitOrderId) {
          await this.binanceService.cancelOrder(position.symbol, position.takeProfitOrderId);
        } else if (position.takeProfitOrderId === orderId && position.stopLossOrderId) {
          await this.binanceService.cancelOrder(position.symbol, position.stopLossOrderId);
        }

        // Remove position from memory
        this.positions.delete(position.id);
      }

    } catch (error) {
      this.logger.error('❌ Error handling order update', error);
    }
  }

  private async placeSLTPOrders(position: Position): Promise<void> {
    try {
      // Calculate SL and TP prices based on entry price and signal levels
      const entryPrice = position.entryPrice;
      let stopLossPrice: number;
      let takeProfitPrice: number;

      if (position.side === 'BUY') {
        // For long positions
        stopLossPrice = Math.min(position.stopLoss, entryPrice * 0.98); // Max 2% loss
        takeProfitPrice = Math.max(position.takeProfit, entryPrice * 1.04); // Min 4% profit
      } else {
        // For short positions
        stopLossPrice = Math.max(position.stopLoss, entryPrice * 1.02); // Max 2% loss
        takeProfitPrice = Math.min(position.takeProfit, entryPrice * 0.96); // Min 4% profit
      }

      // Place stop loss order
      const slOrder = await this.binanceService.placeStopLossOrder(
        position.symbol,
        position.side,
        position.quantity,
        stopLossPrice
      );
      position.stopLossOrderId = slOrder.orderId;

      // Place take profit order
      const tpOrder = await this.binanceService.placeTakeProfitOrder(
        position.symbol,
        position.side,
        position.quantity,
        takeProfitPrice
      );
      position.takeProfitOrderId = tpOrder.orderId;

      this.logger.log(`🎯 SL/TP orders placed for ${position.id}: SL@${stopLossPrice}, TP@${takeProfitPrice}`);

    } catch (error) {
      this.logger.error(`❌ Failed to place SL/TP orders for position ${position.id}`, error);
      throw error;
    }
  }

  // Utility methods for monitoring
  getActivePositions(): Position[] {
    return Array.from(this.positions.values());
  }

  getPositionById(id: string): Position | undefined {
    return this.positions.get(id);
  }
}