import { IsString, IsNumber, IsIn } from 'class-validator';

export class TradingViewWebhookDto {
  @IsNumber()
  low: number;

  @IsNumber()
  high: number;

  @IsString()
  @IsIn(['BUY', 'SELL'])
  type: 'BUY' | 'SELL';

  @IsString()
  symbol: string;
}