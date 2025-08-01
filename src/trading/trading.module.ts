import { Module } from '@nestjs/common';
import { TradingController } from './trading.controller';
import { TradingService } from './trading.service';
import { BinanceModule } from '../binance/binance.module';
import { StorageService } from '../storage/storage.service';

@Module({
  imports: [BinanceModule],
  controllers: [TradingController],
  providers: [TradingService, StorageService],
})
export class TradingModule {}
