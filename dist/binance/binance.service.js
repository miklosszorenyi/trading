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
        this.priceInfoCallback = null;
        this.symbolStreams = {};
        this.apiKey = this.configService.get('BINANCE_API_KEY');
        this.apiSecret = this.configService.get('BINANCE_API_SECRET');
        this.baseURL = this.configService.get('BINANCE_API_BASE_URL');
        this.wsBaseURL = this.configService.get('BINANCE_WS_BASE_URL');
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
    setOrderUpdateCallback(callback) {
        this.orderUpdateCallback = callback;
    }
    setPriceInfoCallback(callback) {
        this.priceInfoCallback = callback;
    }
    async getAccountBalance(asset) {
        try {
            const accountInfo = await this.makeSignedRequest('GET', '/fapi/v2/account');
            return asset
                ? accountInfo.assets.find((b) => b.asset === asset)
                : accountInfo.assets;
        }
        catch (error) {
            this.logger.error('❌ Failed to get account balance', error);
            throw error;
        }
    }
    async getOpenOrders(symbol) {
        try {
            const params = symbol ? { symbol } : {};
            const orders = await this.makeSignedRequest('GET', '/fapi/v1/openOrders', params);
            return orders.map((order) => ({
                ...order,
                price: parseFloat(order.price),
                avgPrice: parseFloat(order.avgPrice),
                origQty: parseFloat(order.origQty),
                executedQty: parseFloat(order.executedQty),
                cumQuote: parseFloat(order.cumQuote),
            }));
        }
        catch (error) {
            this.logger.error('❌ Failed to get open orders', error);
            throw error;
        }
    }
    async getPositions() {
        try {
            const positions = await this.makeSignedRequest('GET', '/fapi/v2/positionRisk');
            return positions
                .filter((pos) => parseFloat(pos.positionAmt) !== 0)
                .map((position) => ({
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
        }
        catch (error) {
            this.logger.error('❌ Failed to get positions', error);
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
            return response.data.symbols.find((s) => s.symbol === symbol);
        }
        catch (error) {
            this.logger.error(`❌ Failed to get symbol info for ${symbol}`, error);
            throw error;
        }
    }
    async placeMarketOrder(symbol, side, quantity, stopPrice) {
        try {
            const params = {
                symbol,
                side,
                type: 'STOP_MARKET',
                quantity,
                stopPrice,
            };
            const order = await this.makeSignedRequest('POST', '/fapi/v1/order', params);
            this.logger.log(`✅ Stop market order placed: ${side} ${quantity} ${symbol} at ${stopPrice} - OrderId: ${order.orderId}`);
            return order;
        }
        catch (error) {
            this.logger.error(`❌ Failed to place stop market order: ${side} ${quantity} ${symbol} at ${stopPrice}`, error);
            throw error;
        }
    }
    async placeStopLossOrder(symbol, side, quantity, stopPrice) {
        try {
            const params = {
                symbol,
                side: side === 'BUY' ? 'SELL' : 'BUY',
                type: 'STOP_MARKET',
                stopPrice,
                closePosition: true,
            };
            const order = await this.makeSignedRequest('POST', '/fapi/v1/order', params);
            this.logger.log(`✅ Stop loss order placed: ${quantity} ${symbol} at ${stopPrice} - OrderId: ${order.orderId}`);
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
                stopPrice,
                closePosition: true,
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
        this.logger.log(`Cancelling order: ${symbol} OrderId: ${orderId}`);
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
        }
    }
    async setLeverage(symbol, leverage) {
        try {
            const params = {
                symbol,
                leverage,
            };
            const result = await this.makeSignedRequest('POST', '/fapi/v1/leverage', params);
            this.logger.log(`✅ Leverage set for ${symbol}: ${leverage}`);
            return result;
        }
        catch (error) {
            this.logger.error(`❌ Failed to set leverage for ${symbol}: ${leverage}`, error);
            throw error;
        }
    }
    async addSymbolsToWatch(symbols) {
        for (const symbol of symbols) {
            if (!this.symbolStreams[symbol]) {
                const stream = await this.setupPriceDataStream(symbol);
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
    removeSymbolsFromWatch(symbols) {
        symbols.forEach((symbol) => {
            if (this.symbolStreams[symbol]) {
                this.symbolStreams[symbol].stream?.close();
                delete this.symbolStreams[symbol];
                this.logger.log(`🔴 Stopped watching symbol: ${symbol}`);
            }
        });
    }
    updateSymbolData(symbol, price) {
        if (this.symbolStreams[symbol]) {
            this.symbolStreams[symbol].data = { symbol, price };
        }
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
    async setupPriceDataStream(symbol) {
        try {
            const wsUrl = `${this.wsBaseURL}/ws/${symbol.toLocaleLowerCase()}@markPrice`;
            const priceStream = new WebSocket(wsUrl);
            priceStream.on('open', () => {
                this.logger.log('📡 Price data stream connected');
            });
            priceStream.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.updateSymbolData(message.s, parseFloat(message.p));
                    if (this.priceInfoCallback) {
                        this.priceInfoCallback(this.symbolStreams[message.s]?.data);
                    }
                }
                catch (error) {
                    this.logger.error('❌ Error parsing price data stream message', error);
                }
            });
            priceStream.on('error', (error) => {
                this.logger.error('❌ Price data stream error', error);
            });
            priceStream.on('close', () => {
                this.logger.warn('⚠️ Price data stream disconnected');
                setTimeout(() => this.setupPriceDataStream(symbol), 5000);
            });
            return priceStream;
        }
        catch (error) {
            this.logger.error('❌ Failed to setup price data stream', error);
        }
        return null;
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
    async cleanup() {
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