import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BinanceService } from '../binance/binance.service';
import { TradingViewWebhookDto } from '../common/dto/tradingview-webhook.dto';
import { Position } from '../common/interfaces/position.interface';
export declare class TradingService implements OnModuleInit {
    private binanceService;
    private configService;
    private readonly logger;
    private positions;
    private readonly maxPositionPercentage;
    constructor(binanceService: BinanceService, configService: ConfigService);
    onModuleInit(): void;
    processTradingSignal(signal: TradingViewWebhookDto): Promise<void>;
    getOrdersAndPositions(): Promise<{
        managedPositions: Position[];
        openOrders: any;
        activePositions: any;
    }>;
    private calculatePositionSize;
    private handleOrderUpdate;
    private placeSLTPOrders;
    getActivePositions(): Position[];
    getPositionById(id: string): Position | undefined;
}
