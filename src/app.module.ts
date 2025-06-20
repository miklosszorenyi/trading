import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TradingModule } from './trading/trading.module';
import { BinanceModule } from './binance/binance.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    BinanceModule,
    TradingModule,
  ],
})
export class AppModule {}