/**
 * Utility functions for extracting filter values from Binance symbol info
 */

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

/**
 * Extracts LOT_SIZE filter from symbol info
 * @param symbolInfo - Binance symbol information
 * @returns LOT_SIZE filter or null if not found
 */
export function getLotSizeFilter(symbolInfo: any): LotSizeFilter | null {
  const filter = symbolInfo?.filters?.find((f: any) => f.filterType === 'LOT_SIZE');
  return filter || null;
}

/**
 * Extracts PRICE_FILTER from symbol info
 * @param symbolInfo - Binance symbol information
 * @returns PRICE_FILTER or null if not found
 */
export function getPriceFilter(symbolInfo: any): PriceFilter | null {
  const filter = symbolInfo?.filters?.find((f: any) => f.filterType === 'PRICE_FILTER');
  return filter || null;
}

/**
 * Extracts MIN_NOTIONAL filter from symbol info
 * @param symbolInfo - Binance symbol information
 * @returns MIN_NOTIONAL filter or null if not found
 */
export function getMinNotionalFilter(symbolInfo: any): MinNotionalFilter | null {
  const filter = symbolInfo?.filters?.find((f: any) => f.filterType === 'MIN_NOTIONAL');
  return filter || null;
}

/**
 * Gets the step size for quantity precision
 * @param symbolInfo - Binance symbol information
 * @returns Step size as number
 */
export function getQuantityStepSize(symbolInfo: any): number {
  const lotSizeFilter = getLotSizeFilter(symbolInfo);
  return lotSizeFilter ? parseFloat(lotSizeFilter.stepSize) : 0.001;
}

/**
 * Gets the tick size for price precision
 * @param symbolInfo - Binance symbol information
 * @returns Tick size as number
 */
export function getPriceTickSize(symbolInfo: any): number {
  const priceFilter = getPriceFilter(symbolInfo);
  return priceFilter ? parseFloat(priceFilter.tickSize) : 0.01;
}

/**
 * Gets minimum quantity allowed
 * @param symbolInfo - Binance symbol information
 * @returns Minimum quantity as number
 */
export function getMinQuantity(symbolInfo: any): number {
  const lotSizeFilter = getLotSizeFilter(symbolInfo);
  return lotSizeFilter ? parseFloat(lotSizeFilter.minQty) : 0;
}

/**
 * Gets maximum quantity allowed
 * @param symbolInfo - Binance symbol information
 * @returns Maximum quantity as number
 */
export function getMaxQuantity(symbolInfo: any): number {
  const lotSizeFilter = getLotSizeFilter(symbolInfo);
  return lotSizeFilter ? parseFloat(lotSizeFilter.maxQty) : Number.MAX_SAFE_INTEGER;
}

/**
 * Gets minimum price allowed
 * @param symbolInfo - Binance symbol information
 * @returns Minimum price as number
 */
export function getMinPrice(symbolInfo: any): number {
  const priceFilter = getPriceFilter(symbolInfo);
  return priceFilter ? parseFloat(priceFilter.minPrice) : 0;
}

/**
 * Gets maximum price allowed
 * @param symbolInfo - Binance symbol information
 * @returns Maximum price as number
 */
export function getMaxPrice(symbolInfo: any): number {
  const priceFilter = getPriceFilter(symbolInfo);
  return priceFilter ? parseFloat(priceFilter.maxPrice) : Number.MAX_SAFE_INTEGER;
}