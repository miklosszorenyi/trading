import { IsString, IsNumber, IsIn, Transform } from 'class-validator';

export class TradingViewWebhookDto {
  @IsNumber()
  low: number;

  @IsNumber()
  high: number;

  @Transform(({ value }) => {
    // Ha a value 0 vagy 1 szám, akkor konvertáljuk string-re
    if (value === 0) return 'SELL';
    if (value === 1) return 'BUY';
    // Ha már string, akkor hagyjuk
    return value;
  })
  @IsNumber()
  @IsIn([0, 1])
  type: 'BUY' | 'SELL';

  @IsString()
  symbol: string;
}