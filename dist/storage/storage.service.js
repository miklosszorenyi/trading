"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const common_1 = require("@nestjs/common");
const fs_1 = require("fs");
class StorageService {
    constructor() {
        this.logger = new common_1.Logger(StorageService.name);
    }
    async setData(dataKey, value) {
        const data = await this.readJsonFile('data.json');
        data[dataKey] = value;
        this.writeJsonFile('data.json', data);
        this.logger.log(`Data set for key ${dataKey}: ${JSON.stringify(value)}`);
    }
    async getData(dataKey) {
        const data = await this.readJsonFile('data.json');
        return data[dataKey] || null;
    }
    async readJsonFile(filePath) {
        return new Promise((resolve, reject) => {
            (0, fs_1.readFile)(filePath, 'utf8', (err, data) => {
                if (err) {
                    this.logger.error(`Failed to read file ${filePath}: ${err.message}`);
                    return reject(err);
                }
                try {
                    const jsonData = JSON.parse(data);
                    this.logger.log(`Successfully read and parsed JSON from ${filePath}`);
                    resolve(jsonData);
                }
                catch (parseError) {
                    this.logger.error(`Failed to parse JSON from ${filePath}: ${parseError.message}`);
                    reject(parseError);
                }
            });
        });
    }
    writeJsonFile(filePath, data) {
        const jsonData = JSON.stringify(data, null, 2);
        require('fs').writeFileSync(filePath, jsonData, 'utf8');
        this.logger.log(`Successfully wrote JSON to ${filePath}`);
    }
}
exports.StorageService = StorageService;
//# sourceMappingURL=storage.service.js.map