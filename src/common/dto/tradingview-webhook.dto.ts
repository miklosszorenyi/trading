import { IsString, IsNumber, IsIn, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

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
  @IsString()
  @IsIn(['BUY', 'SELL'])
  @IsOptional()
  type?: 'BUY' | 'SELL';

  @IsString()
  symbol: string;
}
