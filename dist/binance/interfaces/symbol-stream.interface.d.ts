import * as WebSocket from 'ws';
export interface SymbolStreamMap {
    [symbol: string]: {
        stream: WebSocket | null;
        data: SymbolStreamData;
    };
}
export interface SymbolStreamData {
    symbol: string | null;
    price: number | null;
}
