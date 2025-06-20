"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLotSizeFilter = getLotSizeFilter;
exports.getPriceFilter = getPriceFilter;
exports.getMinNotionalFilter = getMinNotionalFilter;
exports.getQuantityStepSize = getQuantityStepSize;
exports.getPriceTickSize = getPriceTickSize;
exports.getMinQuantity = getMinQuantity;
exports.getMaxQuantity = getMaxQuantity;
exports.getMinPrice = getMinPrice;
exports.getMaxPrice = getMaxPrice;
function getLotSizeFilter(symbolInfo) {
    const filter = symbolInfo?.filters?.find((f) => f.filterType === 'LOT_SIZE');
    return filter || null;
}
function getPriceFilter(symbolInfo) {
    const filter = symbolInfo?.filters?.find((f) => f.filterType === 'PRICE_FILTER');
    return filter || null;
}
function getMinNotionalFilter(symbolInfo) {
    const filter = symbolInfo?.filters?.find((f) => f.filterType === 'MIN_NOTIONAL');
    return filter || null;
}
function getQuantityStepSize(symbolInfo) {
    const lotSizeFilter = getLotSizeFilter(symbolInfo);
    return lotSizeFilter ? parseFloat(lotSizeFilter.stepSize) : 0.001;
}
function getPriceTickSize(symbolInfo) {
    const priceFilter = getPriceFilter(symbolInfo);
    return priceFilter ? parseFloat(priceFilter.tickSize) : 0.01;
}
function getMinQuantity(symbolInfo) {
    const lotSizeFilter = getLotSizeFilter(symbolInfo);
    return lotSizeFilter ? parseFloat(lotSizeFilter.minQty) : 0;
}
function getMaxQuantity(symbolInfo) {
    const lotSizeFilter = getLotSizeFilter(symbolInfo);
    return lotSizeFilter ? parseFloat(lotSizeFilter.maxQty) : Number.MAX_SAFE_INTEGER;
}
function getMinPrice(symbolInfo) {
    const priceFilter = getPriceFilter(symbolInfo);
    return priceFilter ? parseFloat(priceFilter.minPrice) : 0;
}
function getMaxPrice(symbolInfo) {
    const priceFilter = getPriceFilter(symbolInfo);
    return priceFilter ? parseFloat(priceFilter.maxPrice) : Number.MAX_SAFE_INTEGER;
}
//# sourceMappingURL=filter-utils.js.map