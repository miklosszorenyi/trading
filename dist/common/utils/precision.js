"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roundToPrecision = roundToPrecision;
exports.formatToPrecision = formatToPrecision;
exports.validateRange = validateRange;
function roundToPrecision(value, stepSize) {
    if (stepSize === 0)
        return value;
    const decimals = stepSize.toString().split('.')[1]?.length || 0;
    const rounded = Math.floor(value / stepSize) * stepSize;
    return parseFloat(rounded.toFixed(decimals));
}
function formatToPrecision(value, stepSize) {
    const rounded = roundToPrecision(value, stepSize);
    const decimals = stepSize.toString().split('.')[1]?.length || 0;
    return rounded.toFixed(decimals);
}
function validateRange(value, minValue, maxValue) {
    return value >= minValue && value <= maxValue;
}
//# sourceMappingURL=precision.js.map