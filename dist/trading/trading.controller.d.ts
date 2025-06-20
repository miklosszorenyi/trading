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
    getOrdersAndPositions(): Promise<{
        success: boolean;
        data: {
            managedPositions: {
                count: number;
                positions: import("../common/interfaces/position.interface").Position[];
            };
            openOrders: {
                count: any;
                orders: any;
            };
            activePositions: {
                count: any;
                positions: any;
            };
        };
        message?: undefined;
        error?: undefined;
    } | {
        success: boolean;
        message: string;
        error: any;
        data?: undefined;
    }>;
    testEndpoint(): Promise<{
        success: boolean;
        message: string;
        timestamp: string;
    }>;
}
