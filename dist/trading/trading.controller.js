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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var TradingController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradingController = void 0;
const common_1 = require("@nestjs/common");
const trading_service_1 = require("./trading.service");
const tradingview_webhook_dto_1 = require("../common/dto/tradingview-webhook.dto");
const binance_service_1 = require("../binance/binance.service");
const dotenv = require("dotenv");
dotenv.config();
const API_UUID = process.env.UUID || 'api';
let TradingController = TradingController_1 = class TradingController {
    constructor(tradingService, binanceService) {
        this.tradingService = tradingService;
        this.binanceService = binanceService;
        this.logger = new common_1.Logger(TradingController_1.name);
    }
    async handleTradingViewWebhook(webhookData) {
        this.logger.log(`📨 TradingView webhook received (after pipe transformation): ${JSON.stringify(webhookData)}`);
        try {
            const success = await this.tradingService.processTradingSignal(webhookData);
            if (!success) {
                throw new common_1.BadRequestException(`Symbol ${webhookData.symbol} already exists in open orders or positions`);
            }
            return { success: true, message: 'Signal processed successfully' };
        }
        catch (error) {
            this.logger.error('❌ Failed to process trading signal', error);
            return {
                success: false,
                message: 'Failed to process signal',
                error: error.message,
            };
        }
    }
    async fakeprice(fakePriceData) {
        this.tradingService.priceInfoCallback(fakePriceData);
    }
    async stopOrder(orderId, body) {
        const { symbol } = body;
        try {
            if (!(await this.tradingService.cancelOrder(symbol, orderId))) {
                throw new common_1.NotFoundException(`Order with ID ${orderId} not found for symbol ${symbol}`);
            }
            return { success: true, message: 'Order stopped successfully' };
        }
        catch (error) {
            this.logger.error('❌ Failed to stop order', error);
            return {
                success: false,
                message: 'Failed to stop order',
                error: error.message,
            };
        }
    }
    async getOrdersAndPositions() {
        this.logger.log('📋 Orders and positions requested');
        try {
            const data = await this.tradingService.getOrdersAndPositions();
            return {
                success: true,
                data: {
                    balance: await this.binanceService.getAccountBalance(),
                    openOrders: {
                        count: data.openOrders.length,
                        orders: data.openOrders,
                    },
                    activePositions: {
                        count: data.activePositions.length,
                        positions: data.activePositions,
                    },
                },
            };
        }
        catch (error) {
            this.logger.error('❌ Failed to get orders and positions', error);
            return {
                success: false,
                message: 'Failed to get orders and positions',
                error: error.message,
            };
        }
    }
};
exports.TradingController = TradingController;
__decorate([
    (0, common_1.Post)('tradingview'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tradingview_webhook_dto_1.TradingViewWebhookDto]),
    __metadata("design:returntype", Promise)
], TradingController.prototype, "handleTradingViewWebhook", null);
__decorate([
    (0, common_1.Post)('fakeprice'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TradingController.prototype, "fakeprice", null);
__decorate([
    (0, common_1.Delete)('cancelOrder/:orderId'),
    __param(0, (0, common_1.Param)('orderId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], TradingController.prototype, "stopOrder", null);
__decorate([
    (0, common_1.Get)('info'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TradingController.prototype, "getOrdersAndPositions", null);
exports.TradingController = TradingController = TradingController_1 = __decorate([
    (0, common_1.Controller)(API_UUID),
    __metadata("design:paramtypes", [trading_service_1.TradingService,
        binance_service_1.BinanceService])
], TradingController);
//# sourceMappingURL=trading.controller.js.map