import { TradingService } from './trading.service';
import { TradingViewWebhookDto } from '../common/dto/tradingview-webhook.dto';
import { SymbolStreamData } from 'src/binance/interfaces/symbol-stream.interface';
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
    fakeprice(fakePriceData: SymbolStreamData): Promise<void>;
    stopOrder(orderId: number, body: any): Promise<{
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
            openOrders: {
                count: number;
                orders: import("src/trading/interfaces/trading.interface").Order[];
            };
            activePositions: {
                count: number;
                positions: import("src/trading/interfaces/trading.interface").Position[];
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
}
