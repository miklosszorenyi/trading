"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var BinanceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BinanceService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("axios");
const crypto = require("crypto");
const WebSocket = require("ws");
let BinanceService = BinanceService_1 = class BinanceService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(BinanceService_1.name);
        this.userDataStream = null;
        this.listenKey = null;
        this.keepAliveInterval = null;
        this.orderUpdateCallback = null;
        this.baseURL = 'https://testnet.binancefuture.com';
        this.wsBaseURL = 'wss://stream.binancefuture.com';
        this.apiKey = this.configService.get('BINANCE_API_KEY');
        this.apiSecret = this.configService.get('BINANCE_API_SECRET');
        if (!this.apiKey || !this.apiSecret) {
            throw new Error('Binance API credentials not found in environment variables');
        }
        this.httpClient = axios_1.default.create({
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
    createSignature(queryString) {
        return crypto
            .createHmac('sha256', this.apiSecret)
            .update(queryString)
            .digest('hex');
    }
    async makeSignedRequest(method, endpoint, params = {}) {
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
        }
        catch (error) {
            this.logger.error(`❌ API request failed: ${method} ${endpoint}`, error.response?.data || error.message);
            throw error;
        }
    }
    async setupUserDataStream() {
        try {
            const response = await this.makeSignedRequest('POST', '/fapi/v1/listenKey');
            this.listenKey = response.listenKey;
            this.logger.log('🔑 User data stream listen key obtained');
            const wsUrl = `${this.wsBaseURL}/ws/${this.listenKey}`;
            this.userDataStream = new WebSocket(wsUrl);
            this.userDataStream.on('open', () => {
                this.logger.log('📡 User data stream connected');
            });
            this.userDataStream.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    if (message.e === 'ORDER_TRADE_UPDATE') {
                        this.handleOrderUpdate(message.o);
                    }
                }
                catch (error) {
                    this.logger.error('❌ Error parsing WebSocket message', error);
                }
            });
            this.userDataStream.on('error', (error) => {
                this.logger.error('❌ User data stream error', error);
            });
            this.userDataStream.on('close', () => {
                this.logger.warn('⚠️ User data stream disconnected');
                setTimeout(() => this.setupUserDataStream(), 5000);
            });
            this.keepAliveInterval = setInterval(async () => {
                try {
                    await this.makeSignedRequest('PUT', '/fapi/v1/listenKey');
                    this.logger.debug('🔄 User data stream keep-alive sent');
                }
                catch (error) {
                    this.logger.error('❌ Failed to keep alive user data stream', error);
                }
            }, 30 * 60 * 1000);
        }
        catch (error) {
            this.logger.error('❌ Failed to setup user data stream', error);
        }
    }
    handleOrderUpdate(data) {
        this.logger.log(`📊 Order update: ${data.s} ${data.S} ${data.X} - OrderId: ${data.i}`);
        if (this.orderUpdateCallback) {
            this.orderUpdateCallback(data);
        }
    }
    setOrderUpdateCallback(callback) {
        this.orderUpdateCallback = callback;
    }
    async getAccountBalance() {
        try {
            const accountInfo = await this.makeSignedRequest('GET', '/fapi/v2/account');
            return accountInfo.assets;
        }
        catch (error) {
            this.logger.error('❌ Failed to get account balance', error);
            throw error;
        }
    }
    async getSymbolPrice(symbol) {
        try {
            const response = await this.httpClient.get(`/fapi/v1/ticker/price?symbol=${symbol}`);
            return parseFloat(response.data.price);
        }
        catch (error) {
            this.logger.error(`❌ Failed to get price for ${symbol}`, error);
            throw error;
        }
    }
    async getSymbolInfo(symbol) {
        try {
            const response = await this.httpClient.get('/fapi/v1/exchangeInfo');
            return response.data.symbols.find(s => s.symbol === symbol);
        }
        catch (error) {
            this.logger.error(`❌ Failed to get symbol info for ${symbol}`, error);
            throw error;
        }
    }
    async placeMarketOrder(symbol, side, quantity) {
        try {
            const params = {
                symbol,
                side,
                type: 'MARKET',
                quantity,
            };
            const order = await this.makeSignedRequest('POST', '/fapi/v1/order', params);
            this.logger.log(`✅ Market order placed: ${side} ${quantity} ${symbol} - OrderId: ${order.orderId}`);
            return order;
        }
        catch (error) {
            this.logger.error(`❌ Failed to place market order: ${side} ${quantity} ${symbol}`, error);
            throw error;
        }
    }
    async placeStopLossOrder(symbol, side, quantity, stopPrice) {
        try {
            const params = {
                symbol,
                side: side === 'BUY' ? 'SELL' : 'BUY',
                type: 'STOP_MARKET',
                quantity,
                stopPrice: stopPrice.toString(),
            };
            const order = await this.makeSignedRequest('POST', '/fapi/v1/order', params);
            this.logger.log(`🛑 Stop loss order placed: ${quantity} ${symbol} at ${stopPrice} - OrderId: ${order.orderId}`);
            return order;
        }
        catch (error) {
            this.logger.error(`❌ Failed to place stop loss order: ${symbol} at ${stopPrice}`, error);
            throw error;
        }
    }
    async placeTakeProfitOrder(symbol, side, quantity, stopPrice) {
        try {
            const params = {
                symbol,
                side: side === 'BUY' ? 'SELL' : 'BUY',
                type: 'TAKE_PROFIT_MARKET',
                quantity,
                stopPrice: stopPrice.toString(),
            };
            const order = await this.makeSignedRequest('POST', '/fapi/v1/order', params);
            this.logger.log(`🎯 Take profit order placed: ${quantity} ${symbol} at ${stopPrice} - OrderId: ${order.orderId}`);
            return order;
        }
        catch (error) {
            this.logger.error(`❌ Failed to place take profit order: ${symbol} at ${stopPrice}`, error);
            throw error;
        }
    }
    async cancelOrder(symbol, orderId) {
        try {
            const params = {
                symbol,
                orderId,
            };
            const result = await this.makeSignedRequest('DELETE', '/fapi/v1/order', params);
            this.logger.log(`❌ Order cancelled: ${symbol} OrderId: ${orderId}`);
            return result;
        }
        catch (error) {
            this.logger.error(`❌ Failed to cancel order: ${symbol} OrderId: ${orderId}`, error);
            throw error;
        }
    }
    async cleanup() {
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
        }
        if (this.userDataStream) {
            this.userDataStream.close();
        }
        if (this.listenKey) {
            try {
                await this.makeSignedRequest('DELETE', '/fapi/v1/listenKey');
            }
            catch (error) {
                this.logger.error('❌ Failed to close user data stream', error);
            }
        }
    }
};
exports.BinanceService = BinanceService;
exports.BinanceService = BinanceService = BinanceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], BinanceService);
//# sourceMappingURL=binance.service.js.map