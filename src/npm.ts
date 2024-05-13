import {hasScript, isDebug, useInput, usePm, useSecrets} from '@/config.js'
import {out} from '@/output.js'

export enum PnpmAutoFixErrors {
	NO_LOCKFILE = 'ERR_PNPM_NO_LOCKFILE',
	OUTDATED_LOCKFILE = 'ERR_PNPM_OUTDATED_LOCKFILE',
	CONFIG_CONFLICT_LOCKFILE_ONLY_WITH_NO_LOCKFILE = 'ERR_PNPM_CONFIG_CONFLICT_LOCKFILE_ONLY_WITH_NO_LOCKFILE',
	LOCKFILE_UPDATE_FAILED = 'ERR_PNPM_LOCKFILE_UPDATE_FAILED'
}

export function hasPnpmAutoFixError(stdout: string) {
	return Object.values(PnpmAutoFixErrors).some(error => stdout.includes(error))
}

export async function whoAmI(): Promise<string | undefined> {
	const secrets = useSecrets()
	const whoamiFlags = ['--registry', secrets.NPM_REGISTRY]

	try {
		const res = await $`npm whoami ${whoamiFlags}`.quiet()
		if (res.exitCode === 0) {
			return res.stdout
		} else if (isDebug()) {
			out.error(res.stderr || res.stdout)
		}
	} catch (error: any) {
		if (isDebug()) {
			out.error(error.stderr || error.stdout)
		}
	}
}

export const pnx = async scriptName => {
	const input = useInput()
	const pm = await usePm()
	if (hasScript(scriptName)) {
		const fixLint = input.AUTOFIX_LINT && scriptName === 'lint'

		const flags: string[] = []

		if (!input.BAIL_ON_MISSING) {
			flags.push(`--if-present`)
		}

		if (isDebug()) {
			flags.push(`--loglevel=debug`)
		}

		if (input.NO_BAIL && !fixLint) {
			flags.push(`--no-bail`)
		}

		out.info`Running ${scriptName} script`

		try {
			await $`${pm} run ${flags} ${scriptName}`
		} catch (error) {
			if (fixLint) {
				await $`pnpm run ${flags} ${input.AUTOFIX_LINT}`
			} else {
				throw error
			}
		}
	}
}
