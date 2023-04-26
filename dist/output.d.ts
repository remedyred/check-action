export declare function out(pieces: any, ...args: any[]): void;
export declare namespace out {
    var info: (pieces: any, ...args: any[]) => void;
    var success: (pieces: any, ...args: any[]) => void;
    var debug: (pieces: any, ...args: any[]) => void;
    var error: (pieces: any, ...args: any[]) => void;
    var die: (pieces: any, ...args: any[]) => never;
}
export declare const die: (pieces: any, ...args: any[]) => never;
