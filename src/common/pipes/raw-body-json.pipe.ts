import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException, Logger } from '@nestjs/common';

@Injectable()
export class RawBodyJsonPipe implements PipeTransform {
  private readonly logger = new Logger(RawBodyJsonPipe.name);

  transform(value: any, metadata: ArgumentMetadata) {
    console.log('---------------------')
    this.logger.log(`🔄 Raw body received: ${typeof value === 'string' ? value : JSON.stringify(value)}`);

    // Ha string, megpróbáljuk parse-olni
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        this.logger.log(`✅ Successfully parsed JSON: ${JSON.stringify(parsed)}`);
        return parsed;
      } catch (error) {
        this.logger.error(`❌ Failed to parse JSON: ${error.message}`);
        throw new BadRequestException('Invalid JSON format in request body');
      }
    }

    // Ha Buffer (raw body), akkor string-gé alakítjuk és parse-oljuk
    if (Buffer.isBuffer(value)) {
      const stringValue = value.toString('utf8');
      this.logger.log(`🔄 Converting Buffer to string: ${stringValue}`);

      try {
        const parsed = JSON.parse(stringValue);
        this.logger.log(`✅ Successfully parsed JSON from Buffer: ${JSON.stringify(parsed)}`);
        return parsed;
      } catch (error) {
        this.logger.error(`❌ Failed to parse JSON from Buffer: ${error.message}`);
        throw new BadRequestException('Invalid JSON format in request body');
      }
    }


    // Ha már objektum, akkor visszaadjuk
    if (typeof value === 'object' && value !== null) {
      this.logger.log('✅ Body is already an object');
      return value;
    }

    // Egyéb esetben visszaadjuk az eredeti értéket
    this.logger.warn(`⚠️ Unexpected value type: ${typeof value}`);
    return value;
  }
}
