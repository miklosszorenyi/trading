"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var RawBodyJsonPipe_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RawBodyJsonPipe = void 0;
const common_1 = require("@nestjs/common");
let RawBodyJsonPipe = RawBodyJsonPipe_1 = class RawBodyJsonPipe {
    constructor() {
        this.logger = new common_1.Logger(RawBodyJsonPipe_1.name);
    }
    transform(value, metadata) {
        console.log('---------------------');
        this.logger.log(`🔄 Raw body received: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                this.logger.log(`✅ Successfully parsed JSON: ${JSON.stringify(parsed)}`);
                return parsed;
            }
            catch (error) {
                this.logger.error(`❌ Failed to parse JSON: ${error.message}`);
                throw new common_1.BadRequestException('Invalid JSON format in request body');
            }
        }
        if (Buffer.isBuffer(value)) {
            const stringValue = value.toString('utf8');
            this.logger.log(`🔄 Converting Buffer to string: ${stringValue}`);
            try {
                const parsed = JSON.parse(stringValue);
                this.logger.log(`✅ Successfully parsed JSON from Buffer: ${JSON.stringify(parsed)}`);
                return parsed;
            }
            catch (error) {
                this.logger.error(`❌ Failed to parse JSON from Buffer: ${error.message}`);
                throw new common_1.BadRequestException('Invalid JSON format in request body');
            }
        }
        if (typeof value === 'object' && value !== null) {
            this.logger.log('✅ Body is already an object');
            return value;
        }
        this.logger.warn(`⚠️ Unexpected value type: ${typeof value}`);
        return value;
    }
};
exports.RawBodyJsonPipe = RawBodyJsonPipe;
exports.RawBodyJsonPipe = RawBodyJsonPipe = RawBodyJsonPipe_1 = __decorate([
    (0, common_1.Injectable)()
], RawBodyJsonPipe);
//# sourceMappingURL=raw-body-json.pipe.js.map