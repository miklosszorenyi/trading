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
var TradingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradingService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const binance_service_1 = require("../binance/binance.service");
const precision_1 = require("../common/utils/precision");
const filter_utils_1 = require("../common/utils/filter-utils");
const storage_service_1 = require("../storage/storage.service");
let TradingService = TradingService_1 = class TradingService {
    constructor(binanceService, configService, storageService) {
        this.binanceService = binanceService;
        this.configService = configService;
        this.storageService = storageService;
        this.logger = new common_1.Logger(TradingService_1.name);
        this.maxPositionPercentage = this.configService.get('MAX_POSITION_PERCENTAGE', 2);
        this.maxLeverage = this.configService.get('MAX_LEVERAGE', 20);
    }
    async onModuleInit() {
        this.binanceService.setOrderUpdateCallback((data) => {
            this.handleOrderUpdate(data);
        });
        await this.getOrdersAndPositions();
        this.binanceService.setPriceInfoCallback((data) => {
            this.priceInfoCallback(data);
        });
        this.logger.log(`🎯 Trading service initialized`);
    }
    async processTradingSignal(signal) {
        if (this.checkSymbolExists(signal.symbol)) {
            this.logger.warn(`⚠️ Symbol ${signal.symbol} already exists in open orders or positions`);
            return false;
        }
        try {
            this.logger.log(`🔄 Processing ${signal.type} signal for ${signal.symbol}`);
            const symbolInfo = await this.binanceService.getSymbolInfo(signal.symbol);
            if (!symbolInfo) {
                throw new Error(`Symbol ${signal.symbol} not found`);
            }
            const quantity = await this.calculatePositionSize(signal.symbol, symbolInfo, signal);
            if (!quantity) {
                throw new Error('Unable to calculate position size');
            }
            const priceTickSize = (0, filter_utils_1.getPriceTickSize)(symbolInfo);
            const stopPrice = (0, precision_1.roundToPrecision)(signal.type === 'BUY' ? signal.high : signal.low, priceTickSize);
            const minPrice = (0, filter_utils_1.getMinPrice)(symbolInfo);
            const maxPrice = (0, filter_utils_1.getMaxPrice)(symbolInfo);
            if (!(0, precision_1.validateRange)(stopPrice, minPrice, maxPrice)) {
                throw new Error(`Stop price ${stopPrice} is outside allowed range [${minPrice}, ${maxPrice}]`);
            }
            const order = await this.binanceService.placeMarketOrder(signal.symbol, signal.type, (0, precision_1.formatToPrecision)(quantity, (0, filter_utils_1.getQuantityStepSize)(symbolInfo)), (0, precision_1.formatToPrecision)(stopPrice, priceTickSize));
            this.logger.log(`📈 Position created: ${signal.type} ${quantity} ${signal.symbol} at stop price ${stopPrice}`);
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
        }
        catch (error) {
            this.logger.error('❌ Failed to process trading signal', error);
            throw error;
        }
    }
    async getOrdersAndPositions() {
        try {
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
        }
        catch (error) {
            this.logger.error('❌ Failed to get orders and positions', error);
            throw error;
        }
    }
    async cancelOrder(symbol, orderId) {
        if (!this.positionInfo.openOrders.some((order) => order.symbol === symbol && order.orderId === orderId)) {
            this.logger.warn(`⚠️ Order ${orderId} for ${symbol} not found in open orders`);
            return false;
        }
        try {
            this.logger.log(`🛑 Cancelling order ${orderId} for ${symbol}`);
            await this.binanceService.cancelOrder(symbol, orderId);
            return true;
        }
        catch (error) {
            this.logger.error(`❌ Failed to cancel order ${orderId} for ${symbol}`, error);
            throw error;
        }
    }
    async setRequestedOrder(order) {
        const currentOrders = await this.getRequestedOrders();
        currentOrders.push(order);
        return await this.storageService.setData('requestedOrders', currentOrders);
    }
    async getRequestedOrders() {
        return ((await this.storageService.getData('requestedOrders')) ||
            []);
    }
    async getRequestedOrder(orderId) {
        const currentOrders = await this.getRequestedOrders();
        return currentOrders.find((o) => o.orderId === orderId);
    }
    async removeRequestedOrders(order) {
        const currentOrders = await this.getRequestedOrders();
        const updatedOrders = currentOrders.filter((o) => o.orderId !== order.orderId);
        await this.storageService.setData('requestedOrders', updatedOrders);
    }
    async calculatePositionSize(symbol, symbolInfo, signal) {
        const balances = await this.binanceService.getAccountBalance();
        const usdtBalance = balances.find((b) => b.asset === 'USDT')?.walletBalance || '0';
        if (!usdtBalance) {
            this.logger.error('❌ Insufficient USDT balance');
            return null;
        }
        const stepSize = (0, filter_utils_1.getQuantityStepSize)(symbolInfo);
        const minQty = (0, filter_utils_1.getMinQuantity)(symbolInfo);
        const maxQty = (0, filter_utils_1.getMaxQuantity)(symbolInfo);
        const quantity = (0, precision_1.roundToPrecision)((usdtBalance * (this.maxPositionPercentage / 100)) /
            (signal.high - signal.low), stepSize);
        if (!(0, precision_1.validateRange)(quantity, minQty, maxQty)) {
            this.logger.error(`❌ Calculated quantity ${quantity} is outside allowed range [${minQty}, ${maxQty}]`);
            return null;
        }
        const requiredLeverage = Math.ceil((quantity * signal.high) / parseFloat(usdtBalance));
        if (requiredLeverage > this.maxLeverage) {
            this.logger.error(`❌ Required leverage ${requiredLeverage} exceeds max allowed ${this.maxLeverage}`);
            return null;
        }
        else {
            await this.binanceService.setLeverage(symbol, requiredLeverage);
        }
        return quantity;
    }
    async handleOrderUpdate(data) {
        try {
            const symbol = data.s;
            const status = data.X;
            const orderId = data.i;
            const filledQuantity = data.l;
            const orderData = this.positionInfo.openOrders.find((o) => o.orderId === orderId && o.symbol === symbol);
            if (status === 'FILLED') {
                if (orderData.closePosition) {
                    this.closeRelatedOrders(symbol, orderId);
                }
                else {
                    this.placeSLTPOrders(symbol, filledQuantity, orderId);
                }
            }
            await this.getOrdersAndPositions();
        }
        catch (error) {
            this.logger.error('❌ Error handling order update', error);
        }
    }
    priceInfoCallback(data) {
        this.logger.log(`📈 Price update for ${data.symbol}: ${data.price}`);
        this.positionInfo.openOrders.forEach(async (order) => {
            const { symbol, side, orderId, closePosition } = order;
            const relatedOrder = this.positionInfo.requestedOrders.find((o) => o.orderId === orderId);
            if (relatedOrder) {
                let exitPrice = side === 'BUY' ? relatedOrder.low : relatedOrder.high;
                const { price } = data;
                if (symbol === data.symbol) {
                    if (!closePosition &&
                        ((side === 'BUY' && price < exitPrice) ||
                            (side === 'SELL' && price > exitPrice))) {
                        this.logger.log(`🛑 Cancelling order ${orderId} for ${symbol} because price moved against position`);
                        this.binanceService.cancelOrder(symbol, orderId);
                        await this.getOrdersAndPositions();
                    }
                }
            }
        });
    }
    async placeSLTPOrders(symbol, filledQuantity, orderId) {
        const symbolInfo = await this.binanceService.getSymbolInfo(symbol);
        const priceTickSize = (0, filter_utils_1.getPriceTickSize)(symbolInfo);
        const order = await this.getRequestedOrder(orderId);
        const takeProfitPrice = (0, precision_1.roundToPrecision)(order.type === 'BUY'
            ? order.high + (order.high - order.low) * 2
            : order.low - (order.high - order.low) * 2, priceTickSize);
        const stopLossPrice = (0, precision_1.roundToPrecision)(order.type === 'BUY' ? order.low : order.high, priceTickSize);
        await this.binanceService.placeTakeProfitOrder(symbol, order.type, filledQuantity, takeProfitPrice);
        await this.binanceService.placeStopLossOrder(symbol, order.type, filledQuantity, stopLossPrice);
    }
    checkSymbolExists(symbol) {
        return (this.positionInfo.openOrders.some((o) => o.symbol === symbol) ||
            this.positionInfo.activePositions.some((p) => p.symbol === symbol));
    }
    closeRelatedOrders(symbol, orderId) {
        const relatedOrders = this.positionInfo.openOrders.filter((openOrder) => openOrder.symbol === symbol &&
            openOrder.closePosition &&
            openOrder.orderId !== orderId);
        for (const relatedOrder of relatedOrders) {
            this.binanceService.cancelOrder(symbol, relatedOrder.orderId);
            this.logger.log(`🛑 Cancelled related order ${relatedOrder.orderId} for ${symbol}`);
        }
    }
};
exports.TradingService = TradingService;
exports.TradingService = TradingService = TradingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [binance_service_1.BinanceService,
        config_1.ConfigService,
        storage_service_1.StorageService])
], TradingService);
//# sourceMappingURL=trading.service.js.map