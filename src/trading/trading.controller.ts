import { Controller, Post, Get, Body, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { TradingService } from './trading.service';
import { TradingViewWebhookDto } from '../common/dto/tradingview-webhook.dto';

@Controller('webhook')
export class TradingController {
  private readonly logger = new Logger(TradingController.name);

  constructor(private readonly tradingService: TradingService) {}

  @Post('tradingview')
  @HttpCode(HttpStatus.OK)
  async handleTradingViewWebhook(@Body() webhookData: TradingViewWebhookDto) {
    this.logger.log(`📨 TradingView webhook received: ${JSON.stringify(webhookData)}`);
    
    try {
      await this.tradingService.processTradingSignal(webhookData);
      return { success: true, message: 'Signal processed successfully' };
    } catch (error) {
      this.logger.error('❌ Failed to process trading signal', error);
      return { success: false, message: 'Failed to process signal', error: error.message };
    }
  }

  @Get('info')
  @HttpCode(HttpStatus.OK)
  async getOrdersAndPositions() {
    this.logger.log('📋 Orders and positions requested');
    
    try {
      const data = await this.tradingService.getOrdersAndPositions();
      return {
        success: true,
        data: {
          // Memóriában tárolt pozíciók (TradingView signalokból)
          managedPositions: {
            count: data.managedPositions.length,
            positions: data.managedPositions
          },
          // Binance API-ból lekért nyitott megbízások
          openOrders: {
            count: data.openOrders.length,
            orders: data.openOrders
          },
          // Binance API-ból lekért aktív pozíciók
          activePositions: {
            count: data.activePositions.length,
            positions: data.activePositions
          }
        }
      };
    } catch (error) {
      this.logger.error('❌ Failed to get orders and positions', error);
      return { success: false, message: 'Failed to get orders and positions', error: error.message };
    }
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  async testEndpoint() {
    this.logger.log('🧪 Test endpoint called');
    return { 
      success: true, 
      message: 'Trading backend is running',
      timestamp: new Date().toISOString()
    };
  }
}