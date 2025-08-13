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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradingViewWebhookDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class TradingViewWebhookDto {
}
exports.TradingViewWebhookDto = TradingViewWebhookDto;
__decorate([
    (0, class_transformer_1.Transform)(({ value }) => {
        return parseFloat(value);
    }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], TradingViewWebhookDto.prototype, "low", void 0);
__decorate([
    (0, class_transformer_1.Transform)(({ value }) => {
        return parseFloat(value);
    }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], TradingViewWebhookDto.prototype, "high", void 0);
__decorate([
    (0, class_transformer_1.Transform)(({ value }) => {
        if (value === '0')
            return 'SELL';
        if (value === '1')
            return 'BUY';
        return value;
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['BUY', 'SELL']),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], TradingViewWebhookDto.prototype, "type", void 0);
__decorate([
    (0, class_transformer_1.Transform)(({ value }) => {
        return value.split('.')[0];
    }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TradingViewWebhookDto.prototype, "symbol", void 0);
//# sourceMappingURL=tradingview-webhook.dto.js.map