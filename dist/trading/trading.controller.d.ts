import { TradingService } from './trading.service';
import { TradingViewWebhookDto } from '../common/dto/tradingview-webhook.dto';
export declare class TradingController {
    private readonly tradingService;
    private readonly logger;
    constructor(tradingService: TradingService);
    handleTradingViewWebhook(webhookData: TradingViewWebhookDto): Promise<{
        success: boolean;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        message: string;
        error: any;
    }>;
    getActiveOrders(): Promise<{
        success: boolean;
        count: number;
        positions: import("../common/interfaces/position.interface").Position[];
        message?: undefined;
        error?: undefined;
    } | {
        success: boolean;
        message: string;
        error: any;
        count?: undefined;
        positions?: undefined;
    }>;
    testEndpoint(): Promise<{
        success: boolean;
        message: string;
        timestamp: string;
    }>;
}
