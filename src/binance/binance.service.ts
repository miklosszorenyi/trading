import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Binance from 'binance-api-node';
import * as WebSocket from 'ws';
import { Position } from '../common/interfaces/position.interface';

@Injectable()
export class BinanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BinanceService.name);
  private client: any;
  private userDataStream: WebSocket | null = null;
  private listenKey: string | null = null;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private orderUpdateCallback: ((data: any) => void) | null = null;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeBinanceClient();
    await this.setupUserDataStream();
  }

  async onModuleDestroy() {
    await this.cleanup();
  }

  private async initializeBinanceClient() {
    try {
      const apiKey = this.configService.get<string>('BINANCE_API_KEY');
      const apiSecret = this.configService.get<string>('BINANCE_API_SECRET');

      if (!apiKey || !apiSecret) {
        throw new Error('Binance API credentials not found in environment variables');
      }

      this.client = Binance({
        apiKey,
        apiSecret,
        httpBase: 'https://testnet.binancefuture.com',
        wsBase: 'wss://stream.binancefuture.com/ws',
      });

      // Test connection
      await this.client.ping();
      this.logger.log('✅ Connected to Binance Testnet API');

      // Log account info
      const accountInfo = await this.client.accountInfo();
      this.logger.log(`💰 Account balance: ${JSON.stringify(accountInfo.balances.filter(b => parseFloat(b.free) > 0))}`);
    } catch (error) {
      this.logger.error('❌ Failed to initialize Binance client', error);
      throw error;
    }
  }

  private async setupUserDataStream() {
    try {
      // Get listen key for user data stream
      this.listenKey = await this.client.ws.user();
      this.logger.log('🔑 User data stream listen key obtained');

      // Setup WebSocket connection
      const wsUrl = `wss://testnet.binance.vision/ws/${this.listenKey}`;
      this.userDataStream = new WebSocket(wsUrl);

      this.userDataStream.on('open', () => {
        this.logger.log('📡 User data stream connected');
      });

      this.userDataStream.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.e === 'executionReport') {
            this.handleOrderUpdate(message);
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
      this.keepAliveInterval = setInterval(async () => {
        try {
          await this.client.ws.keepAlive(this.listenKey);
          this.logger.debug('🔄 User data stream keep-alive sent');
        } catch (error) {
          this.logger.error('❌ Failed to keep alive user data stream', error);
        }
      }, 30 * 60 * 1000);

    } catch (error) {
      this.logger.error('❌ Failed to setup user data stream', error);
    }
  }

  private handleOrderUpdate(data: any) {
    this.logger.log(`📊 Order update: ${data.s} ${data.S} ${data.X} - OrderId: ${data.i}`);
    
    if (this.orderUpdateCallback) {
      this.orderUpdateCallback(data);
    }
  }

  setOrderUpdateCallback(callback: (data: any) => void) {
    this.orderUpdateCallback = callback;
  }

  async getAccountBalance(): Promise<any> {
    try {
      const accountInfo = await this.client.accountInfo();
      return accountInfo.balances;
    } catch (error) {
      this.logger.error('❌ Failed to get account balance', error);
      throw error;
    }
  }

  async getSymbolPrice(symbol: string): Promise<number> {
    try {
      const ticker = await this.client.prices({ symbol });
      return parseFloat(ticker[symbol]);
    } catch (error) {
      this.logger.error(`❌ Failed to get price for ${symbol}`, error);
      throw error;
    }
  }

  async getSymbolInfo(symbol: string): Promise<any> {
    try {
      const exchangeInfo = await this.client.exchangeInfo();
      return exchangeInfo.symbols.find(s => s.symbol === symbol);
    } catch (error) {
      this.logger.error(`❌ Failed to get symbol info for ${symbol}`, error);
      throw error;
    }
  }

  async placeMarketOrder(symbol: string, side: 'BUY' | 'SELL', quantity: string): Promise<any> {
    try {
      const order = await this.client.order({
        symbol,
        side,
        type: 'MARKET',
        quantity,
      });

      this.logger.log(`✅ Market order placed: ${side} ${quantity} ${symbol} - OrderId: ${order.orderId}`);
      return order;
    } catch (error) {
      this.logger.error(`❌ Failed to place market order: ${side} ${quantity} ${symbol}`, error);
      throw error;
    }
  }

  async placeStopLossOrder(symbol: string, side: 'BUY' | 'SELL', quantity: string, stopPrice: number): Promise<any> {
    try {
      const order = await this.client.order({
        symbol,
        side: side === 'BUY' ? 'SELL' : 'BUY', // Opposite side for stop loss
        type: 'STOP_MARKET',
        quantity,
        stopPrice: stopPrice.toString(),
      });

      this.logger.log(`🛑 Stop loss order placed: ${quantity} ${symbol} at ${stopPrice} - OrderId: ${order.orderId}`);
      return order;
    } catch (error) {
      this.logger.error(`❌ Failed to place stop loss order: ${symbol} at ${stopPrice}`, error);
      throw error;
    }
  }

  async placeTakeProfitOrder(symbol: string, side: 'BUY' | 'SELL', quantity: string, stopPrice: number): Promise<any> {
    try {
      const order = await this.client.order({
        symbol,
        side: side === 'BUY' ? 'SELL' : 'BUY', // Opposite side for take profit
        type: 'TAKE_PROFIT_MARKET',
        quantity,
        stopPrice: stopPrice.toString(),
      });

      this.logger.log(`🎯 Take profit order placed: ${quantity} ${symbol} at ${stopPrice} - OrderId: ${order.orderId}`);
      return order;
    } catch (error) {
      this.logger.error(`❌ Failed to place take profit order: ${symbol} at ${stopPrice}`, error);
      throw error;
    }
  }

  async cancelOrder(symbol: string, orderId: number): Promise<any> {
    try {
      const result = await this.client.cancelOrder({
        symbol,
        orderId,
      });

      this.logger.log(`❌ Order cancelled: ${symbol} OrderId: ${orderId}`);
      return result;
    } catch (error) {
      this.logger.error(`❌ Failed to cancel order: ${symbol} OrderId: ${orderId}`, error);
      throw error;
    }
  }

  private async cleanup() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }

    if (this.userDataStream) {
      this.userDataStream.close();
    }

    if (this.listenKey) {
      try {
        await this.client.ws.close(this.listenKey);
      } catch (error) {
        this.logger.error('❌ Failed to close user data stream', error);
      }
    }
  }
}