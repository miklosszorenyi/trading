import { Logger } from '@nestjs/common';
import { existsSync, readFile, writeFileSync } from 'fs';

export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor() {}

  async setData(dataKey: string, value: Object): Promise<void> {
    const data = await this.readJsonFile('data.json');
    data[dataKey] = value;
    this.writeJsonFile('data.json', data);
    this.logger.log(`Data set for key ${dataKey}: ${JSON.stringify(value)}`);
  }

  async getData(dataKey: string): Promise<Object | null> {
    const data = await this.readJsonFile('data.json');

    return data[dataKey] || null;
  }

  private async readJsonFile(filePath: string): Promise<any> {
    this.createFileIfNotExists(filePath);

    return new Promise((resolve, reject) => {
      readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          this.logger.error(`Failed to read file ${filePath}: ${err.message}`);
          return reject(err);
        }
        try {
          const jsonData = JSON.parse(data);
          this.logger.log(`Successfully read and parsed JSON from ${filePath}`);
          resolve(jsonData);
        } catch (parseError) {
          this.logger.error(
            `Failed to parse JSON from ${filePath}: ${parseError.message}`,
          );
          reject(parseError);
        }
      });
    });
  }

  private writeJsonFile(filePath: string, data: any): void {
    const jsonData = JSON.stringify(data, null, 2);
    require('fs').writeFileSync(filePath, jsonData, 'utf8');
    this.logger.log(`Successfully wrote JSON to ${filePath}`);
  }

  private createFileIfNotExists(filePath: string): void {
    if (!existsSync(filePath)) {
      writeFileSync(filePath, JSON.stringify({}), 'utf8');
      this.logger.log(`Created file ${filePath} as it did not exist`);
    }
  }
}
