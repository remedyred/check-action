export declare function useSecrets(): Record<string, any>;
export declare function setDebug(debug: boolean): void;
export declare function isDebug(): boolean;
interface Input {
    PACKAGE_MANAGER: 'npm' | 'pnpm' | 'yarn';
    SCRIPTS: string;
    NO_BAIL: boolean;
    BAIL_ON_MISSING: boolean;
    AUTOFIX_LOCKFILE: boolean;
    AUTOFIX_LINT: boolean | string;
    BAIL_ON_DIRTY: boolean | string;
    AUTO_COMMIT: boolean | string;
    DEBUG?: boolean | string;
    GITHUB_TOKEN?: string;
    NPM_REGISTRY?: string;
    NPM_TOKEN?: string;
    NPM_REGISTRY_SCOPE?: string;
}
export declare function useInput(): Input;
export declare function usePm(): Promise<"npm" | "pnpm" | "yarn">;
export declare const hasScript: (scriptName: any) => boolean | undefined;
export {};
