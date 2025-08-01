import {
  Controller,
  Post,
  Get,
  Body,
  Logger,
  HttpCode,
  HttpStatus,
  UsePipes,
  Param,
  Delete,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TradingService } from './trading.service';
import { TradingViewWebhookDto } from '../common/dto/tradingview-webhook.dto';
import { RawBodyJsonPipe } from '../common/pipes/raw-body-json.pipe';
import { PositionInfo } from 'src/trading/interfaces/trading.interface';
import { BinanceService } from 'src/binance/binance.service';
import { SymbolStreamData } from 'src/binance/interfaces/symbol-stream.interface';

@Controller('webhook')
export class TradingController {
  private readonly logger = new Logger(TradingController.name);

  constructor(private readonly tradingService: TradingService) {}

  @Post('tradingview')
  // @UsePipes(new RawBodyJsonPipe())
  async handleTradingViewWebhook(@Body() webhookData: TradingViewWebhookDto) {
    this.logger.log(
      `📨 TradingView webhook received (after pipe transformation): ${JSON.stringify(webhookData)}`,
    );

    try {
      const success =
        await this.tradingService.processTradingSignal(webhookData);

      if (!success) {
        throw new BadRequestException(
          `Symbol ${webhookData.symbol} already exists in open orders or positions`,
        );
      }

      return { success: true, message: 'Signal processed successfully' };
    } catch (error) {
      this.logger.error('❌ Failed to process trading signal', error);
      return {
        success: false,
        message: 'Failed to process signal',
        error: error.message,
      };
    }
  }

  @Post('fakeprice')
  // @UsePipes(new RawBodyJsonPipe())
  async fakeprice(@Body() fakePriceData: SymbolStreamData) {
    this.tradingService.priceInfoCallback(fakePriceData);
  }

  @Delete('cancelOrder/:orderId')
  async stopOrder(@Param('orderId') orderId: number, @Body() body: any) {
    const { symbol } = body;

    try {
      if (!(await this.tradingService.cancelOrder(symbol, orderId))) {
        throw new NotFoundException(
          `Order with ID ${orderId} not found for symbol ${symbol}`,
        );
      }

      return { success: true, message: 'Order stopped successfully' };
    } catch (error) {
      this.logger.error('❌ Failed to stop order', error);

      return {
        success: false,
        message: 'Failed to stop order',
        error: error.message,
      };
    }
  }

  @Get('info')
  async getOrdersAndPositions() {
    this.logger.log('📋 Orders and positions requested');

    try {
      const data: PositionInfo =
        await this.tradingService.getOrdersAndPositions();
      return {
        success: true,
        data: {
          // Binance API-ból lekért nyitott megbízások
          openOrders: {
            count: data.openOrders.length,
            orders: data.openOrders,
          },
          // Binance API-ból lekért aktív pozíciók
          activePositions: {
            count: data.activePositions.length,
            positions: data.activePositions,
          },
        },
      };
    } catch (error) {
      this.logger.error('❌ Failed to get orders and positions', error);
      return {
        success: false,
        message: 'Failed to get orders and positions',
        error: error.message,
      };
    }
  }
}
