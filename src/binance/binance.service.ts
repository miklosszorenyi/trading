import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import * as WebSocket from 'ws';

@Injectable()
export class BinanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BinanceService.name);
  private httpClient: AxiosInstance;
  private apiKey: string;
  private apiSecret: string;
  private userDataStream: WebSocket | null = null;
  private listenKey: string | null = null;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private orderUpdateCallback: ((data: any) => void) | null = null;

  private readonly baseURL = 'https://testnet.binance.vision';
  private readonly wsBaseURL = 'wss://testnet.binance.vision/ws';

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
      this.apiKey = this.configService.get<string>('BINANCE_API_KEY');
      this.apiSecret = this.configService.get<string>('BINANCE_API_SECRET');

      if (!this.apiKey || !this.apiSecret) {
        throw new Error('Binance API credentials not found in environment variables');
      }

      this.httpClient = axios.create({
        baseURL: this.baseURL,
        headers: {
          'X-MBX-APIKEY': this.apiKey,
        },
      });

      // Test connection
      await this.httpClient.get('/api/v3/ping');
      this.logger.log('✅ Connected to Binance Testnet API');

      // Log account info
      const accountInfo = await this.getAccountInfo();
      const nonZeroBalances = accountInfo.balances.filter(b => parseFloat(b.free) > 0);
      this.logger.log(`💰 Account balance: ${JSON.stringify(nonZeroBalances)}`);
    } catch (error) {
      this.logger.error('❌ Failed to initialize Binance client', error);
      throw error;
    }
  }

  private createSignature(queryString: string): string {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  private async makeSignedRequest(method: 'GET' | 'POST' | 'DELETE', endpoint: string, params: any = {}) {
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
      this.logger.error(`❌ API request failed: ${method} ${endpoint}`, error.response?.data || error.message);
      throw error;
    }
  }

  private async setupUserDataStream() {
    try {
      // Get listen key for user data stream
      const response = await this.makeSignedRequest('POST', '/api/v3/userDataStream');
      this.listenKey = response.listenKey;
      this.logger.log('🔑 User data stream listen key obtained');

      // Setup WebSocket connection
      const wsUrl = `${this.wsBaseURL}/${this.listenKey}`;
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
          await this.makeSignedRequest('PUT', '/api/v3/userDataStream', { listenKey: this.listenKey });
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

  private async getAccountInfo(): Promise<any> {
    return await this.makeSignedRequest('GET', '/api/v3/account');
  }

  async getAccountBalance(): Promise<any> {
    try {
      const accountInfo = await this.getAccountInfo();
      return accountInfo.balances;
    } catch (error) {
      this.logger.error('❌ Failed to get account balance', error);
      throw error;
    }
  }

  async getSymbolPrice(symbol: string): Promise<number> {
    try {
      const response = await this.httpClient.get(`/api/v3/ticker/price?symbol=${symbol}`);
      return parseFloat(response.data.price);
    } catch (error) {
      this.logger.error(`❌ Failed to get price for ${symbol}`, error);
      throw error;
    }
  }

  async getSymbolInfo(symbol: string): Promise<any> {
    try {
      const response = await this.httpClient.get('/api/v3/exchangeInfo');
      return response.data.symbols.find(s => s.symbol === symbol);
    } catch (error) {
      this.logger.error(`❌ Failed to get symbol info for ${symbol}`, error);
      throw error;
    }
  }

  async placeMarketOrder(symbol: string, side: 'BUY' | 'SELL', quantity: string): Promise<any> {
    try {
      const params = {
        symbol,
        side,
        type: 'MARKET',
        quantity,
      };

      const order = await this.makeSignedRequest('POST', '/api/v3/order', params);
      this.logger.log(`✅ Market order placed: ${side} ${quantity} ${symbol} - OrderId: ${order.orderId}`);
      return order;
    } catch (error) {
      this.logger.error(`❌ Failed to place market order: ${side} ${quantity} ${symbol}`, error);
      throw error;
    }
  }

  async placeStopLossOrder(symbol: string, side: 'BUY' | 'SELL', quantity: string, stopPrice: number): Promise<any> {
    try {
      const params = {
        symbol,
        side: side === 'BUY' ? 'SELL' : 'BUY', // Opposite side for stop loss
        type: 'STOP_MARKET',
        quantity,
        stopPrice: stopPrice.toString(),
      };

      const order = await this.makeSignedRequest('POST', '/api/v3/order', params);
      this.logger.log(`🛑 Stop loss order placed: ${quantity} ${symbol} at ${stopPrice} - OrderId: ${order.orderId}`);
      return order;
    } catch (error) {
      this.logger.error(`❌ Failed to place stop loss order: ${symbol} at ${stopPrice}`, error);
      throw error;
    }
  }

  async placeTakeProfitOrder(symbol: string, side: 'BUY' | 'SELL', quantity: string, stopPrice: number): Promise<any> {
    try {
      const params = {
        symbol,
        side: side === 'BUY' ? 'SELL' : 'BUY', // Opposite side for take profit
        type: 'TAKE_PROFIT_MARKET',
        quantity,
        stopPrice: stopPrice.toString(),
      };

      const order = await this.makeSignedRequest('POST', '/api/v3/order', params);
      this.logger.log(`🎯 Take profit order placed: ${quantity} ${symbol} at ${stopPrice} - OrderId: ${order.orderId}`);
      return order;
    } catch (error) {
      this.logger.error(`❌ Failed to place take profit order: ${symbol} at ${stopPrice}`, error);
      throw error;
    }
  }

  async cancelOrder(symbol: string, orderId: number): Promise<any> {
    try {
      const params = {
        symbol,
        orderId,
      };

      const result = await this.makeSignedRequest('DELETE', '/api/v3/order', params);
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
        await this.makeSignedRequest('DELETE', '/api/v3/userDataStream', { listenKey: this.listenKey });
      } catch (error) {
        this.logger.error('❌ Failed to close user data stream', error);
      }
    }
  }
}