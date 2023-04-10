#!/usr/bin/env zx

import {JSONParse} from '@snickbit/utilities'
import fs, {PathLike} from 'fs'
import 'zx/globals'

/**
 * Get JSON from file
 * @see @snickbit/node-utilities#getFileJSON
 */
export function getFileJSON(filepath: PathLike, fallback?: any) {
	filepath = path.normalize(filepath as string)
	const content = fs.existsSync(filepath) ? fs.readFileSync(filepath, 'utf8') : fallback
	return content ? JSONParse(content, fallback) : fallback
}

const die = (pieces, ...args) => {
	echo(chalk.red(`[DIE]`), pieces, ...args)
	process.exit(1)
}

const success = (pieces, ...args) => {
	echo(chalk.green(`[SUCCESS]`), pieces, ...args)
}

const debug = (pieces, ...args) => {
	if (isDebug()) {
		echo(chalk.yellow(`[DEBUG]`), pieces, ...args)
	}
}

const isDebug = () => {
	return process.env.DEBUG === 'true'
}

void async function() {
	const args = argv._.slice(1)

	interface Input {
		PACKAGE_MANAGER: string
		SCRIPTS: string
		NO_BAIL: boolean
		BAIL_ON_MISSING: boolean
		AUTOFIX_LOCKFILE: boolean
		AUTOFIX_LINT: string | false
		BAIL_ON_DIRTY: boolean | string
		AUTO_COMMIT: boolean | string
		DEBUG?: boolean
		GITHUB_TOKEN?: string
		NPM_REGISTRY?: string
		NPM_TOKEN?: string
	}

	const inputDefaults: Input = {
		PACKAGE_MANAGER: 'pnpm',
		SCRIPTS: 'build,test,lint,docs',
		NO_BAIL: false,
		BAIL_ON_MISSING: false,
		AUTOFIX_LOCKFILE: true,
		AUTOFIX_LINT: 'lint:fix',
		BAIL_ON_DIRTY: false,
		AUTO_COMMIT: true,
		DEBUG: false,
		GITHUB_TOKEN: process.env.GITHUB_TOKEN,
		NPM_REGISTRY: process.env.NPM_REGISTRY,
		NPM_TOKEN: process.env.NPM_TOKEN || process.env.NPM_AUTH_TOKEN
	}

	const input = {
		...inputDefaults,
		...JSONParse<Input>(args[0])
	}
	input.DEBUG ||= process.env.RUNNER_DEBUG === 'true'
	process.env.DEBUG = input.DEBUG ? 'true' : 'false'
	try {
		await which(input.PACKAGE_MANAGER)
	} catch {
		die`Package manager "${input.PACKAGE_MANAGER}" not found`
	}
	const pm = [input.PACKAGE_MANAGER]
	const packageJson = getFileJSON('package.json')
	const availableScripts = Object.keys(packageJson?.scripts || {})

	if (input.NPM_TOKEN) {
		process.env.NPM_TOKEN = input.NPM_TOKEN
		process.env.NODE_AUTH_TOKEN = input.NPM_TOKEN
	}

	if (input.NPM_REGISTRY) {
		process.env.NPM_REGISTRY = input.NPM_REGISTRY
	}

	if (input.GITHUB_TOKEN) {
		process.env.GITHUB_TOKEN = input.GITHUB_TOKEN
	}

	const hasScript = scriptName => {
		return availableScripts.includes(scriptName)
	}

	const pnx = async scriptName => {
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

	echo`Install dependencies`
	const installParams: string[] = []

	if (pm.includes('pnpm')) {
		installParams.push('install', `--loglevel=${isDebug() ? 'debug' : 'warn'}`, '--frozen-lockfile')
	} else if (pm.includes('yarn')) {
		installParams.push('install', '--frozen-lockfile')
	} else if (pm.includes('npm')) {
		installParams.push('ci', '--no-audit', '--no-fund')
	}

	try {
		await $`${pm} ${installParams}`
	} catch (error: any) {
		if (error.stderr.includes('ERR_PNPM_OUTDATED_LOCKFILE') && input.AUTOFIX_LOCKFILE) {
			debug`Updating lockfile`
			const lockfile: string[] = []
			if (pm.includes('pnpm')) {
				installParams.push('--fix-lockfile')
				lockfile.push('pnpm-lock.yaml')
			} else if (pm.includes('yarn')) {
				installParams.splice(1, 1, '--update-checksums', '--check-files')
				lockfile.push('yarn.lock')
			} else if (pm.includes('npm')) {
				installParams.splice(0, 1, 'install')
				lockfile.push('package-lock.json')
			}
			await $`${pm} ${installParams}`
			await $`git add ${lockfile}`
			await $`git commit -m "chore: update lockfile [skip ci]"`
			await $`git push`
		} else {
			debug`Error installing dependencies: ${error}`
			die`Error installing dependencies ${error.stderr}`
		}
	}
	success`Dependencies installed`

	for (const script of input.SCRIPTS.split(',')) {
		await pnx(script)
	}

	if (input.BAIL_ON_DIRTY) {
		const gitStatus = await $`git status --porcelain`
		if (gitStatus.stdout) {
			const bailOnDirty = input.BAIL_ON_DIRTY === true ? 'true' : input.BAIL_ON_DIRTY
			die`${bailOnDirty} ${gitStatus.stdout}`
		}
	} else if (input.AUTO_COMMIT) {
		echo`Committing changes`
		const gitStatus = await $`git status --porcelain`
		if (gitStatus.stdout) {
			const paths = input.AUTO_COMMIT === true ? '.' : input.AUTO_COMMIT
			await $`git add ${paths}`
			await $`git commit -m "chore: update files modified by CI [skip ci]"`
			await $`git push`
		}
	}
}()
