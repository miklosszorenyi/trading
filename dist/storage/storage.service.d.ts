export declare class StorageService {
    private readonly logger;
    constructor();
    setData(dataKey: string, value: Object): Promise<void>;
    getData(dataKey: string): Promise<Object | null>;
    private readJsonFile;
    private writeJsonFile;
}
