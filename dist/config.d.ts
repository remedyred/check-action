export declare function useSecrets(): Record<string, any>;
export declare function setDebug(debug: boolean): void;
export declare function isDebug(): boolean;
export declare function isGitReady(): boolean;
export declare function setGitReady(ready?: boolean): void;
export declare enum InputKeys {
    PACKAGE_MANAGER = "PACKAGE_MANAGER",
    SCRIPTS = "SCRIPTS",
    NO_BAIL = "NO_BAIL",
    BAIL_ON_MISSING = "BAIL_ON_MISSING",
    AUTOFIX_LOCKFILE = "AUTOFIX_LOCKFILE",
    AUTOFIX_LINT = "AUTOFIX_LINT",
    BAIL_ON_DIRTY = "BAIL_ON_DIRTY",
    AUTO_COMMIT = "AUTO_COMMIT",
    DEBUG = "DEBUG",
    GITHUB_TOKEN = "GITHUB_TOKEN",
    NPM_REGISTRY = "NPM_REGISTRY",
    NPM_TOKEN = "NPM_TOKEN",
    NPM_REGISTRY_SCOPE = "NPM_REGISTRY_SCOPE",
    PREVENT_COMMITS = "PREVENT_COMMITS",
    PNPM_VERSION = "PNPM_VERSION"
}
type MappedInput = {
    [key in InputKeys]?: boolean | string;
};
interface Input extends MappedInput {
    PACKAGE_MANAGER: 'npm' | 'pnpm' | 'yarn';
    SCRIPTS: string;
    NO_BAIL: boolean;
    BAIL_ON_MISSING: boolean;
    AUTOFIX_LOCKFILE: boolean;
    GITHUB_TOKEN?: string;
    NPM_REGISTRY?: string;
    NPM_TOKEN?: string;
    NPM_REGISTRY_SCOPE?: string;
    PREVENT_COMMITS?: boolean;
    PNPM_VERSION?: string;
}
export declare function useInput(): Input;
export declare function usePm(): Promise<"npm" | "pnpm" | "yarn">;
export declare const hasScript: (scriptName: any) => boolean | undefined;
export declare const requiresGit: (name?: string) => boolean | undefined;
export {};
