import { IsString, IsNumber, IsIn, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

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
    if (value === '0') return 'SELL';
    if (value === '1') return 'BUY';
    return value;
  })
  @IsString()
  @IsIn(['BUY', 'SELL'])
  @IsOptional()
  type?: 'BUY' | 'SELL';

  @Transform(({ value }) => {
    return value.split('.')[0]; // because of perpetual symbols: BTCUSDT.P
  })
  @IsString()
  symbol: string;
}
