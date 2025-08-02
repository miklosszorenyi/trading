import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import * as WebSocket from 'ws';
import {
  SymbolStreamData,
  SymbolStreamMap,
} from './interfaces/symbol-stream.interface';
import {
  OrderDTO,
  PositionDTO,
} from 'src/trading/interfaces/trading.interface';
import { PlaceOrderParams } from './interfaces/place-order-params.interface';

@Injectable()
export class BinanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BinanceService.name);
  private httpClient: AxiosInstance;
  private apiKey: string;
  private apiSecret: string;
  private baseURL: string;
  private wsBaseURL: string;
  private userDataStream: WebSocket | null = null;
  private listenKey: string | null = null;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private orderUpdateCallback: ((data: any) => void) | null = null;
  private priceInfoCallback: ((data: any) => void) | null = null;
  private symbolStreams: SymbolStreamMap = {};

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('BINANCE_API_KEY');
    this.apiSecret = this.configService.get<string>('BINANCE_API_SECRET');
    this.baseURL = this.configService.get<string>('BINANCE_API_BASE_URL');
    this.wsBaseURL = this.configService.get<string>('BINANCE_WS_BASE_URL');

    if (!this.apiKey || !this.apiSecret) {
      throw new Error(
        'Binance API credentials not found in environment variables',
      );
    }

    this.httpClient = axios.create({
      baseURL: this.baseURL,
      headers: {
        'X-MBX-APIKEY': this.apiKey,
      },
    });
  }

  async onModuleInit() {
    await this.setupUserDataStream();
    this.logger.log('✅ Binance service initialized');
  }

  async onModuleDestroy() {
    await this.cleanup();
  }

  setOrderUpdateCallback(callback: (data: any) => void) {
    this.orderUpdateCallback = callback;
  }

  setPriceInfoCallback(callback: (data: SymbolStreamData) => void) {
    this.priceInfoCallback = callback;
  }

  async getAccountBalance(asset?: string): Promise<any> {
    try {
      const accountInfo = await this.makeSignedRequest(
        'GET',
        '/fapi/v2/account',
      );
      return asset
        ? accountInfo.assets.find((b) => b.asset === asset)
        : accountInfo.assets;
    } catch (error) {
      this.logger.error('❌ Failed to get account balance', error);
      throw error;
    }
  }

  async getOpenOrders(symbol?: string): Promise<any> {
    try {
      const params = symbol ? { symbol } : {};
      const orders = await this.makeSignedRequest(
        'GET',
        '/fapi/v1/openOrders',
        params,
      );
      return orders.map((order: OrderDTO) => ({
        ...order,
        price: parseFloat(order.price),
        avgPrice: parseFloat(order.avgPrice),
        origQty: parseFloat(order.origQty),
        executedQty: parseFloat(order.executedQty),
        cumQuote: parseFloat(order.cumQuote),
      }));
    } catch (error) {
      this.logger.error('❌ Failed to get open orders', error);
      throw error;
    }
  }

  async getPositions(): Promise<any> {
    try {
      const positions = await this.makeSignedRequest(
        'GET',
        '/fapi/v2/positionRisk',
      );
      // Filter out positions with zero size
      return positions
        .filter((pos) => parseFloat(pos.positionAmt) !== 0)
        .map((position: PositionDTO) => ({
          ...position,
          entryPrice: parseFloat(position.entryPrice),
          breakEvenPrice: parseFloat(position.entryPrice),
          isAutoAddMargin: position.isAutoAddMargin === 'true' ? true : false,
          isolatedMargin: parseFloat(position.isolatedMargin),
          leverage: parseInt(position.leverage),
          liquidationPrice: parseFloat(position.liquidationPrice),
          markPrice: parseFloat(position.markPrice),
          maxNotionalValue: parseFloat(position.maxNotionalValue),
          positionAmt: parseFloat(position.positionAmt),
          notional: parseFloat(position.notional),
          isolatedWallet: parseFloat(position.isolatedWallet),
          unRealizedProfit: parseFloat(position.unRealizedProfit),
        }));
    } catch (error) {
      this.logger.error('❌ Failed to get positions', error);
      throw error;
    }
  }

  async getSymbolPrice(symbol: string): Promise<number> {
    try {
      const response = await this.httpClient.get(
        `/fapi/v1/ticker/price?symbol=${symbol}`,
      );
      return parseFloat(response.data.price);
    } catch (error) {
      this.logger.error(`❌ Failed to get price for ${symbol}`, error);
      throw error;
    }
  }

  async getSymbolInfo(symbol: string): Promise<any> {
    try {
      const response = await this.httpClient.get('/fapi/v1/exchangeInfo');
      return response.data.symbols.find((s) => s.symbol === symbol);
    } catch (error) {
      this.logger.error(`❌ Failed to get symbol info for ${symbol}`, error);
      throw error;
    }
  }

  async placeMarketOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    stopPrice: number,
  ): Promise<OrderDTO> {
    try {
      const params: PlaceOrderParams = {
        symbol,
        side,
        type: 'STOP_MARKET',
        quantity,
        stopPrice,
      };

      const order = await this.makeSignedRequest(
        'POST',
        '/fapi/v1/order',
        params,
      );
      this.logger.log(
        `✅ Stop market order placed: ${side} ${quantity} ${symbol} at ${stopPrice} - OrderId: ${order.orderId}`,
      );
      return order;
    } catch (error) {
      this.logger.error(
        `❌ Failed to place stop market order: ${side} ${quantity} ${symbol} at ${stopPrice}`,
        error,
      );
      throw error;
    }
  }

  async placeStopLossOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    stopPrice: number,
  ): Promise<OrderDTO> {
    try {
      const params: PlaceOrderParams = {
        symbol,
        side: side === 'BUY' ? 'SELL' : 'BUY', // +
        type: 'STOP_MARKET',
        stopPrice,
        closePosition: true,
      };

      const order = await this.makeSignedRequest(
        'POST',
        '/fapi/v1/order',
        params,
      );
      this.logger.log(
        `✅ Stop loss order placed: ${quantity} ${symbol} at ${stopPrice} - OrderId: ${order.orderId}`,
      );
      return order;
    } catch (error) {
      this.logger.error(
        `❌ Failed to place stop loss order: ${symbol} at ${stopPrice}`,
        error,
      );
      throw error;
    }
  }

  async placeTakeProfitOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    stopPrice: number,
  ): Promise<OrderDTO> {
    try {
      const params: PlaceOrderParams = {
        symbol,
        side: side === 'BUY' ? 'SELL' : 'BUY',
        type: 'TAKE_PROFIT_MARKET',
        stopPrice,
        closePosition: true,
      };

      const order = await this.makeSignedRequest(
        'POST',
        '/fapi/v1/order',
        params,
      );
      this.logger.log(
        `🎯 Take profit order placed: ${quantity} ${symbol} at ${stopPrice} - OrderId: ${order.orderId}`,
      );
      return order;
    } catch (error) {
      this.logger.error(
        `❌ Failed to place take profit order: ${symbol} at ${stopPrice}`,
        error,
      );
      throw error;
    }
  }

  async cancelOrder(symbol: string, orderId: number): Promise<any> {
    this.logger.log(`Cancelling order: ${symbol} OrderId: ${orderId}`);

    try {
      const params = {
        symbol,
        orderId,
      };

      const result = await this.makeSignedRequest(
        'DELETE',
        '/fapi/v1/order',
        params,
      );
      this.logger.log(`❌ Order cancelled: ${symbol} OrderId: ${orderId}`);
      return result;
    } catch (error) {
      this.logger.error(
        `❌ Failed to cancel order: ${symbol} OrderId: ${orderId}`,
        error,
      );
      // throw error;
    }
  }

  async setLeverage(symbol: string, leverage: number): Promise<any> {
    try {
      const params = {
        symbol,
        leverage,
      };
      const result = await this.makeSignedRequest(
        'POST',
        '/fapi/v1/leverage',
        params,
      );
      this.logger.log(`✅ Leverage set for ${symbol}: ${leverage}`);
      return result;
    } catch (error) {
      this.logger.error(
        `❌ Failed to set leverage for ${symbol}: ${leverage}`,
        error,
      );
      throw error;
    }
  }

  async addSymbolsToWatch(symbols: string[]) {
    for (const symbol of symbols) {
      if (!this.symbolStreams[symbol]) {
        const stream: WebSocket = await this.setupPriceDataStream(symbol);
        if (stream) {
          this.symbolStreams[symbol] = {
            stream,
            data: {
              symbol: null,
              price: null,
            },
          };
          this.logger.log(`🟢 Started watching symbol: ${symbol}`);
        }
      }
    }
  }

  private removeSymbolsFromWatch(symbols: string[]) {
    symbols.forEach((symbol) => {
      if (this.symbolStreams[symbol]) {
        this.symbolStreams[symbol].stream?.close();
        delete this.symbolStreams[symbol];
        this.logger.log(`🔴 Stopped watching symbol: ${symbol}`);
      }
    });
  }

  private updateSymbolData(symbol: string, price: number) {
    if (this.symbolStreams[symbol]) {
      this.symbolStreams[symbol].data = { symbol, price };
    }
  }

  private createSignature(queryString: string): string {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  private async makeSignedRequest(
    method: 'GET' | 'POST' | 'DELETE' | 'PUT',
    endpoint: string,
    params: any = {},
  ) {
    const timestamp = Date.now();
    const queryString = new URLSearchParams({
      ...params,
      timestamp: timestamp.toString(),
    }).toString();

    const signature = this.createSignature(queryString);
    const finalQueryString = `${queryString}&signature=${signature}`;

    try {
      const response = await this.httpClient.request({
        method,
        url: `${endpoint}?${finalQueryString}`,
      });
      return response.data;
    } catch (error) {
      this.logger.error(
        `❌ API request failed: ${method} ${endpoint}`,
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  private async setupPriceDataStream(
    symbol: string,
  ): Promise<WebSocket | null> {
    try {
      const wsUrl = `${this.wsBaseURL}/ws/${symbol.toLocaleLowerCase()}@markPrice`;
      const priceStream = new WebSocket(wsUrl);

      priceStream.on('open', () => {
        this.logger.log('📡 Price data stream connected');
      });

      priceStream.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.updateSymbolData(message.s, parseFloat(message.p));
          if (this.priceInfoCallback) {
            this.priceInfoCallback(this.symbolStreams[message.s]?.data);
          }
        } catch (error) {
          this.logger.error(
            '❌ Error parsing price data stream message',
            error,
          );
        }
      });

      priceStream.on('error', (error) => {
        this.logger.error('❌ Price data stream error', error);
      });

      priceStream.on('close', () => {
        this.logger.warn('⚠️ Price data stream disconnected');
        // Attempt to reconnect after 5 seconds
        setTimeout(() => this.setupPriceDataStream(symbol), 5000);
      });

      return priceStream;
    } catch (error) {
      this.logger.error('❌ Failed to setup price data stream', error);
    }

    return null;
  }

  private async setupUserDataStream() {
    try {
      // Get listen key for user data stream
      const response = await this.makeSignedRequest(
        'POST',
        '/fapi/v1/listenKey',
      );
      this.listenKey = response.listenKey;
      this.logger.log('🔑 User data stream listen key obtained');

      // Setup WebSocket connection - Futures testnet WebSocket URL
      const wsUrl = `${this.wsBaseURL}/ws/${this.listenKey}`;
      this.userDataStream = new WebSocket(wsUrl);

      this.userDataStream.on('open', () => {
        this.logger.log('📡 User data stream connected');
      });

      this.userDataStream.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.e === 'ORDER_TRADE_UPDATE') {
            this.handleOrderUpdate(message.o);
          }
        } catch (error) {
          this.logger.error('❌ Error parsing WebSocket message', error);
        }
      });

      this.userDataStream.on('error', (error) => {
        this.logger.error('❌ User data stream error', error);
      });

      this.userDataStream.on('close', () => {
        this.logger.warn('⚠️ User data stream disconnected');
        // Attempt to reconnect after 5 seconds
        setTimeout(() => this.setupUserDataStream(), 5000);
      });

      // Keep alive the listen key every 30 minutes
      this.keepAliveInterval = setInterval(
        async () => {
          try {
            await this.makeSignedRequest('PUT', '/fapi/v1/listenKey');
            this.logger.debug('🔄 User data stream keep-alive sent');
          } catch (error) {
            this.logger.error(
              '❌ Failed to keep alive user data stream',
              error,
            );
          }
        },
        30 * 60 * 1000,
      );
    } catch (error) {
      this.logger.error('❌ Failed to setup user data stream', error);
    }
  }

  private handleOrderUpdate(data: any) {
    this.logger.log(
      `📊 Order update: ${data.s} ${data.S} ${data.X} - OrderId: ${data.i}`,
    );

    if (this.orderUpdateCallback) {
      this.orderUpdateCallback(data);
    }
  }

  private async cleanup() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }

    if (this.userDataStream) {
      this.userDataStream.close();
    }

    this.removeSymbolsFromWatch(Object.keys(this.symbolStreams));

    if (this.listenKey) {
      try {
        await this.makeSignedRequest('DELETE', '/fapi/v1/listenKey');
      } catch (error) {
        this.logger.error('❌ Failed to close user data stream', error);
      }
    }
  }
}
