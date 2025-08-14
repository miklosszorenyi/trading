import { IsString, IsNumber, IsIn, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { OrderSide } from 'src/trading/interfaces/trading.interface';

export class TradingViewWebhookDto {
  @Transform(({ value }) => {
    return parseFloat(value);
  })
  @IsNumber()
  low: number;

  @Transform(({ value }) => {
    return parseFloat(value);
  })
  @IsNumber()
  high: number;

  @Transform(({ value }) => {
    if (value === '0') return OrderSide.SELL;
    if (value === '1') return OrderSide.BUY;
    return value;
  })
  @IsString()
  @IsIn([OrderSide.BUY, OrderSide.SELL])
  @IsOptional()
  type?: OrderSide;

  @Transform(({ value }) => {
    return value.split('.')[0]; // because of perpetual symbols: BTCUSDT.P
  })
  @IsString()
  symbol: string;
}
