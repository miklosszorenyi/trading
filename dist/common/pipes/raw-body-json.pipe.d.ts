import { PipeTransform, ArgumentMetadata } from '@nestjs/common';
export declare class RawBodyJsonPipe implements PipeTransform {
    private readonly logger;
    transform(value: any, metadata: ArgumentMetadata): any;
}
