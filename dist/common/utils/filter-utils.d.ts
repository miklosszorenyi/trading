export interface LotSizeFilter {
    filterType: 'LOT_SIZE';
    minQty: string;
    maxQty: string;
    stepSize: string;
}
export interface PriceFilter {
    filterType: 'PRICE_FILTER';
    minPrice: string;
    maxPrice: string;
    tickSize: string;
}
export interface MinNotionalFilter {
    filterType: 'MIN_NOTIONAL';
    minNotional: string;
}
export declare function getLotSizeFilter(symbolInfo: any): LotSizeFilter | null;
export declare function getPriceFilter(symbolInfo: any): PriceFilter | null;
export declare function getMinNotionalFilter(symbolInfo: any): MinNotionalFilter | null;
export declare function getQuantityStepSize(symbolInfo: any): number;
export declare function getPriceTickSize(symbolInfo: any): number;
export declare function getMinQuantity(symbolInfo: any): number;
export declare function getMaxQuantity(symbolInfo: any): number;
export declare function getMinPrice(symbolInfo: any): number;
export declare function getMaxPrice(symbolInfo: any): number;
