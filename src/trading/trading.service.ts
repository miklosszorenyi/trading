import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BinanceService } from '../binance/binance.service';
import {
  Order,
  OrderDTO,
  OrderSide,
  OrderType,
  PositionInfo,
  RequestedOrder,
} from './interfaces/trading.interface';
import {
  roundToPrecision,
  formatToPrecision,
  validateRange,
} from '../common/utils/precision';
import {
  getQuantityStepSize,
  getPriceTickSize,
  getMinQuantity,
  getMaxQuantity,
  getMinPrice,
  getMaxPrice,
} from '../common/utils/filter-utils';
import { TradingViewWebhookDto } from 'src/common/dto/tradingview-webhook.dto';
import { SymbolStreamData } from 'src/binance/interfaces/symbol-stream.interface';
import { StorageService } from 'src/storage/storage.service';

@Injectable()
export class TradingService implements OnModuleInit {
  private readonly logger = new Logger(TradingService.name);
  private readonly maxPositionPercentage: number;
  private readonly maxLeverage: number;
  private readonly binanceTradingAsset: string;
  private positionInfo: PositionInfo;

  constructor(
    private binanceService: BinanceService,
    private configService: ConfigService,
    private storageService: StorageService,
  ) {
    this.maxPositionPercentage = this.configService.get<number>(
      'MAX_POSITION_PERCENTAGE',
      2,
    );
    this.maxLeverage = this.configService.get<number>('MAX_LEVERAGE', 20);
    this.binanceTradingAsset = this.configService.get<string>(
      'BINANCE_TRADING_ASSET',
      'USDT',
    );
  }

  async onModuleInit() {
    // Set up order update callback
    this.binanceService.setOrderUpdateCallback((data) => {
      this.handleOrderUpdate(data);
    });

    await this.getOrdersAndPositions();

    this.binanceService.setPriceInfoCallback((data: SymbolStreamData) => {
      this.priceInfoCallback(data);
    });

    this.logger.log(`🎯 Trading service initialized`);
  }

  async processTradingSignal(signal: TradingViewWebhookDto): Promise<boolean> {
    if (this.checkSymbolExists(signal.symbol)) {
      this.logger.warn(
        `⚠️ Symbol ${signal.symbol} already exists in open orders or positions`,
      );
      return false;
    }

    try {
      this.logger.log(
        `🔄 Processing ${signal.type} signal for ${signal.symbol}`,
      );

      // Get symbol info for precision handling
      const symbolInfo = await this.binanceService.getSymbolInfo(signal.symbol);
      if (!symbolInfo) {
        throw new Error(`Symbol ${signal.symbol} not found`);
      }

      // Calculate position size with proper precision using signal high/low
      const quantity = await this.calculatePositionSize(
        signal.symbol,
        symbolInfo,
        signal,
      );

      if (!quantity) {
        throw new Error('Unable to calculate position size');
      }

      // Get current price for stop price calculation
      // const currentPrice = await this.binanceService.getSymbolPrice(signal.symbol);

      // Calculate stop price based on signal direction with proper precision
      const priceTickSize = getPriceTickSize(symbolInfo);
      const stopPrice: number = roundToPrecision(
        signal.type === OrderSide.BUY ? signal.high : signal.low,
        priceTickSize,
      );

      // Validate price range
      const minPrice = getMinPrice(symbolInfo);
      const maxPrice = getMaxPrice(symbolInfo);

      if (!validateRange(stopPrice, minPrice, maxPrice)) {
        throw new Error(
          `Stop price ${stopPrice} is outside allowed range [${minPrice}, ${maxPrice}]`,
        );
      }

      // Place stop market order with properly formatted values
      const order = await this.binanceService.placeLimitOrder(
        signal.symbol,
        signal.type,
        formatToPrecision(quantity, getQuantityStepSize(symbolInfo)),
        // formatToPrecision(stopPrice, priceTickSize),
      );

      // position.orderId = order.orderId;

      this.logger.log(
        `📈 Position created: ${signal.type} ${quantity} ${signal.symbol} at stop price ${stopPrice}`,
      );

      await this.setRequestedOrder({
        orderId: order.orderId,
        symbol: signal.symbol,
        type: signal.type,
        low: signal.low,
        high: signal.high,
        requestTime: new Date(),
      });

      await this.getOrdersAndPositions();

      return true;
    } catch (error) {
      this.logger.error('❌ Failed to process trading signal', error);

      throw error;
    }
  }

  async getOrdersAndPositions(): Promise<PositionInfo> {
    try {
      // Binance API-ból lekért adatok
      const [openOrders, activePositions, requestedOrders] = await Promise.all([
        this.binanceService.getOpenOrders(),
        this.binanceService.getPositions(),
        this.getRequestedOrders(),
      ]);

      this.positionInfo = {
        openOrders,
        activePositions,
        requestedOrders,
      };

      this.binanceService.addSymbolsToWatch([
        ...this.positionInfo.openOrders.map((p) => p.symbol),
        ...this.positionInfo.activePositions.map((p) => p.symbol),
      ]);

      return this.positionInfo;
    } catch (error) {
      this.logger.error('❌ Failed to get orders and positions', error);
      throw error;
    }
  }

  async cancelOrder(symbol: string, orderId: number): Promise<boolean> {
    if (
      !this.positionInfo.openOrders.some(
        (order) => order.symbol === symbol && order.orderId === orderId,
      )
    ) {
      this.logger.warn(
        `⚠️ Order ${orderId} for ${symbol} not found in open orders`,
      );
      return false;
    }

    try {
      this.logger.log(`🛑 Cancelling order ${orderId} for ${symbol}`);
      await this.binanceService.cancelOrder(symbol, orderId);
      // await this.getOrdersAndPositions();
      return true;
    } catch (error) {
      this.logger.error(
        `❌ Failed to cancel order ${orderId} for ${symbol}`,
        error,
      );
      throw error;
    }
  }

  async setRequestedOrder(order: RequestedOrder): Promise<void> {
    const currentOrders = await this.getRequestedOrders();
    currentOrders.push(order);
    return await this.storageService.setData('requestedOrders', currentOrders);
  }

  async getRequestedOrders(): Promise<RequestedOrder[]> {
    return ((await this.storageService.getData('requestedOrders')) ||
      []) as RequestedOrder[];
  }

  async getRequestedOrder(
    orderId: number,
  ): Promise<RequestedOrder | undefined> {
    const currentOrders = await this.getRequestedOrders();
    return currentOrders.find((o) => o.orderId === orderId);
  }

  async removeRequestedOrders(order: RequestedOrder): Promise<void> {
    const currentOrders = await this.getRequestedOrders();
    const updatedOrders = currentOrders.filter(
      (o) => o.orderId !== order.orderId,
    );
    await this.storageService.setData('requestedOrders', updatedOrders);
  }

  private async calculatePositionSize(
    symbol: string,
    symbolInfo?: any,
    signal?: TradingViewWebhookDto,
  ): Promise<number | null> {
    // Get account balance
    const balances = await this.binanceService.getAccountBalance(
      this.binanceTradingAsset,
    );
    const tradingBalance = balances?.walletBalance || '0';

    if (!tradingBalance) {
      this.logger.error('❌ Insufficient balance');
      return null;
    }

    // Get precision values
    const stepSize = getQuantityStepSize(symbolInfo);
    const minQty = getMinQuantity(symbolInfo);
    const maxQty = getMaxQuantity(symbolInfo);

    // Round to step size with proper precision
    const quantity = roundToPrecision(
      (tradingBalance * (this.maxPositionPercentage / 100)) /
        (signal.high - signal.low),
      stepSize,
    );

    // Validate quantity range
    if (!validateRange(quantity, minQty, maxQty)) {
      this.logger.error(
        `❌ Calculated quantity ${quantity} is outside allowed range [${minQty}, ${maxQty}]`,
      );
      return null;
    }

    const requiredLeverage = Math.ceil(
      (quantity * signal.high) / parseFloat(tradingBalance),
    );

    if (requiredLeverage > this.maxLeverage) {
      this.logger.error(
        `❌ Required leverage ${requiredLeverage} exceeds max allowed ${this.maxLeverage}`,
      );
      return null;
    } else {
      await this.binanceService.setLeverage(symbol, requiredLeverage);
    }

    return quantity;
  }

  private async handleOrderUpdate(data: any): Promise<void> {
    try {
      const symbol = data.s;
      const status = data.X;
      const orderId = data.i;
      const filledQuantity = data.l;
      const orderData = this.positionInfo.openOrders.find(
        (o) => o.orderId === orderId && o.symbol === symbol,
      );

      if (status === 'FILLED') {
        if (orderData.closePosition) {
          this.closeRelatedOrders(symbol, orderId);
        } else {
          this.placeSLTPOrders(symbol, filledQuantity, orderId);
        }
      }

      await this.getOrdersAndPositions();
    } catch (error) {
      this.logger.error('❌ Error handling order update', error);
    }
  }

  /*private*/
  priceInfoCallback(data: SymbolStreamData): void {
    this.logger.log(`📈 Price update for ${data.symbol}: ${data.price}`);

    this.positionInfo.openOrders.forEach(async (order: Order) => {
      const { symbol, side, orderId, closePosition } = order;
      const relatedOrder: RequestedOrder =
        this.positionInfo.requestedOrders.find((o) => o.orderId === orderId);

      if (relatedOrder) {
        let exitPrice =
          side === OrderSide.BUY ? relatedOrder.low : relatedOrder.high;
        const { price } = data;

        if (symbol === data.symbol) {
          if (
            !closePosition &&
            ((side === OrderSide.BUY && price < exitPrice) ||
              (side === OrderSide.SELL && price > exitPrice))
          ) {
            this.logger.log(
              `🛑 Cancelling order ${orderId} for ${symbol} because price moved against position`,
            );
            this.binanceService.cancelOrder(symbol, orderId);
            await this.getOrdersAndPositions();
          }
        }
      }
    });
  }

  private async placeSLTPOrders(
    symbol: string,
    filledQuantity: number,
    orderId: number,
  ): Promise<void> {
    const symbolInfo = await this.binanceService.getSymbolInfo(symbol);

    const priceTickSize = getPriceTickSize(symbolInfo);

    // place TP order
    const order = await this.getRequestedOrder(orderId);
    const takeProfitPrice = roundToPrecision(
      order.type === OrderSide.BUY
        ? order.high + (order.high - order.low) * 2
        : order.low - (order.high - order.low) * 2,
      priceTickSize,
    );
    const stopLossPrice = roundToPrecision(
      order.type === OrderSide.BUY ? order.low : order.high,
      priceTickSize,
    );

    await this.binanceService.placeTakeProfitOrder(
      symbol,
      order.type,
      filledQuantity,
      takeProfitPrice,
      OrderType.TAKE_PROFIT_LIMIT,
    );

    // place SL order
    await this.binanceService.placeStopLossOrder(
      symbol,
      order.type,
      filledQuantity,
      stopLossPrice,
      OrderType.LIMIT,
    );
  }

  private checkSymbolExists(symbol: string): boolean {
    return (
      this.positionInfo.openOrders.some((o) => o.symbol === symbol) ||
      this.positionInfo.activePositions.some((p) => p.symbol === symbol)
    );
  }

  private closeRelatedOrders(symbol: string, orderId: number): void {
    const relatedOrders = this.positionInfo.openOrders.filter(
      (openOrder) =>
        openOrder.symbol === symbol &&
        openOrder.closePosition &&
        openOrder.orderId !== orderId,
    );

    for (const relatedOrder of relatedOrders) {
      this.binanceService.cancelOrder(symbol, relatedOrder.orderId);
      this.logger.log(
        `🛑 Cancelled related order ${relatedOrder.orderId} for ${symbol}`,
      );
    }
  }
}
