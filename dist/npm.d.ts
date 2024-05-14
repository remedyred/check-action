export declare enum PnpmAutoFixErrors {
    NO_LOCKFILE = "ERR_PNPM_NO_LOCKFILE",
    OUTDATED_LOCKFILE = "ERR_PNPM_OUTDATED_LOCKFILE",
    CONFIG_CONFLICT_LOCKFILE_ONLY_WITH_NO_LOCKFILE = "ERR_PNPM_CONFIG_CONFLICT_LOCKFILE_ONLY_WITH_NO_LOCKFILE",
    LOCKFILE_UPDATE_FAILED = "ERR_PNPM_LOCKFILE_UPDATE_FAILED"
}
export declare function hasPnpmAutoFixError(stdout: string): boolean;
export declare function whoAmI(): Promise<string | undefined>;
export declare const pnx: (scriptName: any) => Promise<void>;
