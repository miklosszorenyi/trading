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
let TradingService = TradingService_1 = class TradingService {
    constructor(binanceService, configService) {
        this.binanceService = binanceService;
        this.configService = configService;
        this.logger = new common_1.Logger(TradingService_1.name);
        this.positions = new Map();
        this.maxPositionPercentage = this.configService.get('MAX_POSITION_PERCENTAGE', 2);
    }
    onModuleInit() {
        this.binanceService.setOrderUpdateCallback((data) => {
            this.handleOrderUpdate(data);
        });
        this.logger.log(`🎯 Trading service initialized with ${this.maxPositionPercentage}% max position size`);
    }
    async processTradingSignal(signal) {
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
            const currentPrice = await this.binanceService.getSymbolPrice(signal.symbol);
            const priceTickSize = (0, filter_utils_1.getPriceTickSize)(symbolInfo);
            let stopPrice;
            if (signal.type === 'BUY') {
                stopPrice = (0, precision_1.roundToPrecision)(currentPrice * 1.001, priceTickSize);
            }
            else {
                stopPrice = (0, precision_1.roundToPrecision)(currentPrice * 0.999, priceTickSize);
            }
            const minPrice = (0, filter_utils_1.getMinPrice)(symbolInfo);
            const maxPrice = (0, filter_utils_1.getMaxPrice)(symbolInfo);
            if (!(0, precision_1.validateRange)(stopPrice, minPrice, maxPrice)) {
                throw new Error(`Stop price ${stopPrice} is outside allowed range [${minPrice}, ${maxPrice}]`);
            }
            const positionId = `${signal.symbol}_${Date.now()}`;
            const position = {
                id: positionId,
                symbol: signal.symbol,
                side: signal.type,
                quantity,
                entryPrice: 0,
                stopLoss: signal.low,
                takeProfit: signal.high,
                orderId: 0,
                status: 'PENDING',
                createdAt: new Date(),
            };
            const order = await this.binanceService.placeMarketOrder(signal.symbol, signal.type, (0, precision_1.formatToPrecision)(quantity, (0, filter_utils_1.getQuantityStepSize)(symbolInfo)), (0, precision_1.formatToPrecision)(stopPrice, priceTickSize));
            position.orderId = order.orderId;
            this.positions.set(positionId, position);
            this.logger.log(`📈 Position created: ${positionId} - ${signal.type} ${quantity} ${signal.symbol} at stop price ${stopPrice}`);
        }
        catch (error) {
            this.logger.error('❌ Failed to process trading signal', error);
            throw error;
        }
    }
    async getOrdersAndPositions() {
        try {
            const managedPositions = this.getActivePositions();
            const [openOrders, activePositions] = await Promise.all([
                this.binanceService.getOpenOrders(),
                this.binanceService.getPositions()
            ]);
            return {
                managedPositions,
                openOrders,
                activePositions
            };
        }
        catch (error) {
            this.logger.error('❌ Failed to get orders and positions', error);
            throw error;
        }
    }
    async calculatePositionSize(symbol, symbolInfo, signal) {
        try {
            if (!symbolInfo) {
                symbolInfo = await this.binanceService.getSymbolInfo(symbol);
            }
            const balances = await this.binanceService.getAccountBalance();
            const usdtBalance = balances.find(b => b.asset === 'USDT');
            if (!usdtBalance || parseFloat(usdtBalance.walletBalance) <= 0) {
                this.logger.error('❌ Insufficient USDT balance');
                return null;
            }
            const availableBalance = parseFloat(usdtBalance.walletBalance);
            const maxPositionValue = (availableBalance * this.maxPositionPercentage) / 100;
            let referencePrice;
            if (signal) {
                referencePrice = (signal.high + signal.low) / 2;
                this.logger.log(`💡 Using signal reference price: ${referencePrice} (avg of ${signal.high} and ${signal.low})`);
            }
            else {
                referencePrice = await this.binanceService.getSymbolPrice(symbol);
                this.logger.log(`💡 Using current market price: ${referencePrice}`);
            }
            const stepSize = (0, filter_utils_1.getQuantityStepSize)(symbolInfo);
            const minQty = (0, filter_utils_1.getMinQuantity)(symbolInfo);
            const maxQty = (0, filter_utils_1.getMaxQuantity)(symbolInfo);
            let quantity = maxPositionValue / referencePrice;
            quantity = (0, precision_1.roundToPrecision)(quantity, stepSize);
            if (!(0, precision_1.validateRange)(quantity, minQty, maxQty)) {
                this.logger.error(`❌ Calculated quantity ${quantity} is outside allowed range [${minQty}, ${maxQty}]`);
                return null;
            }
            this.logger.log(`💰 Position size calculated: ${quantity} ${symbol} (${maxPositionValue} USDT at ${referencePrice})`);
            return quantity;
        }
        catch (error) {
            this.logger.error('❌ Failed to calculate position size', error);
            return null;
        }
    }
    async handleOrderUpdate(data) {
        try {
            const orderId = data.i;
            const symbol = data.s;
            const status = data.X;
            const side = data.S;
            const executedQty = parseFloat(data.z);
            const avgPrice = parseFloat(data.Z) / executedQty || 0;
            this.logger.log(`📊 Order update: ${symbol} ${side} ${status} - OrderId: ${orderId}`);
            const position = Array.from(this.positions.values()).find(p => p.orderId === orderId ||
                p.stopLossOrderId === orderId ||
                p.takeProfitOrderId === orderId);
            if (!position) {
                this.logger.debug(`🔍 No position found for order ${orderId}`);
                return;
            }
            if (position.orderId === orderId && status === 'FILLED' && position.status === 'PENDING') {
                position.status = 'FILLED';
                position.entryPrice = avgPrice;
                position.filledAt = new Date();
                this.logger.log(`✅ Position filled: ${position.id} at ${avgPrice}`);
                await this.placeSLTPOrders(position);
            }
            if ((position.stopLossOrderId === orderId || position.takeProfitOrderId === orderId) && status === 'FILLED') {
                position.status = 'CLOSED';
                const orderType = position.stopLossOrderId === orderId ? 'Stop Loss' : 'Take Profit';
                this.logger.log(`🎯 ${orderType} executed for position ${position.id}`);
                if (position.stopLossOrderId === orderId && position.takeProfitOrderId) {
                    await this.binanceService.cancelOrder(position.symbol, position.takeProfitOrderId);
                }
                else if (position.takeProfitOrderId === orderId && position.stopLossOrderId) {
                    await this.binanceService.cancelOrder(position.symbol, position.stopLossOrderId);
                }
                this.positions.delete(position.id);
            }
        }
        catch (error) {
            this.logger.error('❌ Error handling order update', error);
        }
    }
    async placeSLTPOrders(position) {
        try {
            const symbolInfo = await this.binanceService.getSymbolInfo(position.symbol);
            if (!symbolInfo) {
                throw new Error(`Symbol ${position.symbol} not found`);
            }
            const priceTickSize = (0, filter_utils_1.getPriceTickSize)(symbolInfo);
            const quantityStepSize = (0, filter_utils_1.getQuantityStepSize)(symbolInfo);
            const entryPrice = position.entryPrice;
            let stopLossPrice;
            let takeProfitPrice;
            if (position.side === 'BUY') {
                stopLossPrice = Math.min(position.stopLoss, entryPrice * 0.98);
                takeProfitPrice = Math.max(position.takeProfit, entryPrice * 1.04);
            }
            else {
                stopLossPrice = Math.max(position.stopLoss, entryPrice * 1.02);
                takeProfitPrice = Math.min(position.takeProfit, entryPrice * 0.96);
            }
            stopLossPrice = (0, precision_1.roundToPrecision)(stopLossPrice, priceTickSize);
            takeProfitPrice = (0, precision_1.roundToPrecision)(takeProfitPrice, priceTickSize);
            const minPrice = (0, filter_utils_1.getMinPrice)(symbolInfo);
            const maxPrice = (0, filter_utils_1.getMaxPrice)(symbolInfo);
            if (!(0, precision_1.validateRange)(stopLossPrice, minPrice, maxPrice)) {
                throw new Error(`Stop loss price ${stopLossPrice} is outside allowed range`);
            }
            if (!(0, precision_1.validateRange)(takeProfitPrice, minPrice, maxPrice)) {
                throw new Error(`Take profit price ${takeProfitPrice} is outside allowed range`);
            }
            const slOrder = await this.binanceService.placeStopLossOrder(position.symbol, position.side, (0, precision_1.formatToPrecision)(position.quantity, quantityStepSize), (0, precision_1.formatToPrecision)(stopLossPrice, priceTickSize));
            position.stopLossOrderId = slOrder.orderId;
            const tpOrder = await this.binanceService.placeTakeProfitOrder(position.symbol, position.side, (0, precision_1.formatToPrecision)(position.quantity, quantityStepSize), (0, precision_1.formatToPrecision)(takeProfitPrice, priceTickSize));
            position.takeProfitOrderId = tpOrder.orderId;
            this.logger.log(`🎯 SL/TP orders placed for ${position.id}: SL@${stopLossPrice}, TP@${takeProfitPrice}`);
        }
        catch (error) {
            this.logger.error(`❌ Failed to place SL/TP orders for position ${position.id}`, error);
            throw error;
        }
    }
    getActivePositions() {
        return Array.from(this.positions.values());
    }
    getPositionById(id) {
        return this.positions.get(id);
    }
};
exports.TradingService = TradingService;
exports.TradingService = TradingService = TradingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [binance_service_1.BinanceService,
        config_1.ConfigService])
], TradingService);
//# sourceMappingURL=trading.service.js.map