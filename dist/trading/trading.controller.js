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
let TradingController = TradingController_1 = class TradingController {
    constructor(tradingService) {
        this.tradingService = tradingService;
        this.logger = new common_1.Logger(TradingController_1.name);
    }
    async handleTradingViewWebhook(webhookData) {
        this.logger.log(`📨 TradingView webhook received: ${JSON.stringify(webhookData)}`);
        try {
            await this.tradingService.processTradingSignal(webhookData);
            return { success: true, message: 'Signal processed successfully' };
        }
        catch (error) {
            this.logger.error('❌ Failed to process trading signal', error);
            return { success: false, message: 'Failed to process signal', error: error.message };
        }
    }
    async getOrdersAndPositions() {
        this.logger.log('📋 Orders and positions requested');
        try {
            const data = await this.tradingService.getOrdersAndPositions();
            return {
                success: true,
                data: {
                    managedPositions: {
                        count: data.managedPositions.length,
                        positions: data.managedPositions
                    },
                    openOrders: {
                        count: data.openOrders.length,
                        orders: data.openOrders
                    },
                    activePositions: {
                        count: data.activePositions.length,
                        positions: data.activePositions
                    }
                }
            };
        }
        catch (error) {
            this.logger.error('❌ Failed to get orders and positions', error);
            return { success: false, message: 'Failed to get orders and positions', error: error.message };
        }
    }
    async testEndpoint() {
        this.logger.log('🧪 Test endpoint called');
        return {
            success: true,
            message: 'Trading backend is running',
            timestamp: new Date().toISOString()
        };
    }
};
exports.TradingController = TradingController;
__decorate([
    (0, common_1.Post)('tradingview'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tradingview_webhook_dto_1.TradingViewWebhookDto]),
    __metadata("design:returntype", Promise)
], TradingController.prototype, "handleTradingViewWebhook", null);
__decorate([
    (0, common_1.Get)('orders'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TradingController.prototype, "getOrdersAndPositions", null);
__decorate([
    (0, common_1.Post)('test'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TradingController.prototype, "testEndpoint", null);
exports.TradingController = TradingController = TradingController_1 = __decorate([
    (0, common_1.Controller)('webhook'),
    __metadata("design:paramtypes", [trading_service_1.TradingService])
], TradingController);
//# sourceMappingURL=trading.controller.js.map