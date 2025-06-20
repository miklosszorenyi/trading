"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const logger = new common_1.Logger('Bootstrap');
    try {
        const app = await core_1.NestFactory.create(app_module_1.AppModule);
        app.useGlobalPipes(new common_1.ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }));
        app.enableCors({
            origin: '*',
            methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
            allowedHeaders: 'Content-Type, Accept, Authorization',
        });
        const port = process.env.PORT || 3000;
        await app.listen(port);
        logger.log(`🚀 Binance Trading Backend running on port ${port}`);
        logger.log(`📊 Ready to receive TradingView webhooks`);
    }
    catch (error) {
        logger.error('❌ Failed to start application', error);
        process.exit(1);
    }
}
bootstrap();
//# sourceMappingURL=main.js.map