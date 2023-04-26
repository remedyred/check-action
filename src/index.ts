#!/usr/bin/env zx

import {isString, JSONParse, JSONPrettify, objectExcept, parse} from '@snickbit/utilities'
import fs, {PathLike} from 'fs'
import 'zx/globals'

function stringify(arg: ProcessOutput | any) {
	if (arg instanceof ProcessOutput) {
		return arg.toString().replace(/\n$/, '')
	}
	return `${arg}`
}

/**
 * Get JSON from file
 * @see @snickbit/node-utilities#getFileJSON
 */
export function getFileJSON(filepath: PathLike, fallback?: any) {
	filepath = path.normalize(filepath as string)
	const content = fs.existsSync(filepath) ? fs.readFileSync(filepath, 'utf8') : fallback
	return content ? JSONParse(content, fallback) : fallback
}

const secrets: Record<string, any> = {}

const stripSecrets = (msg: string) => {
	for (const [name, value] of Object.entries(secrets)) {
		if (value) {
			msg = msg.replace(value, isDebug ? chalk.white.bold(`{{${chalk.yellow(name)}}}`) : '***')
		}
	}

	return msg
}

const out = (prefix: string, pieces: TemplateStringsArray, ...args: any[]) => {
	const lastIdx = pieces.length - 1
	const msg = Array.isArray(pieces) && pieces.every(element => isString(element)) && lastIdx === args.length
		? args.map((arg, argIndex) => pieces[argIndex] + stringify(arg)).join('') + pieces[lastIdx]
		: [pieces, ...args].map(element => stringify(element)).join(' ')

	console.log(stripSecrets(msg))
}

const log = (pieces, ...args) => {
	out(chalk.white(`[LOG]`), pieces, ...args)
}

const info = (pieces, ...args) => {
	out(chalk.blue(`[INFO]`), pieces, ...args)
}

const die = (pieces, ...args) => {
	out(chalk.red(`[DIE]`), pieces, ...args)
	process.exit(1)
}

const success = (pieces, ...args) => {
	out(chalk.green(`[SUCCESS]`), pieces, ...args)
}

const debug = (pieces, ...args) => {
	if (isDebug) {
		out(chalk.yellow(`[DEBUG]`), pieces, ...args)
	}
}

let isDebug = false

async function main() {
	const args = argv._

	interface Input {
		PACKAGE_MANAGER: string
		SCRIPTS: string
		NO_BAIL: boolean
		BAIL_ON_MISSING: boolean
		AUTOFIX_LOCKFILE: boolean
		AUTOFIX_LINT: boolean | string
		BAIL_ON_DIRTY: boolean | string
		AUTO_COMMIT: boolean | string
		DEBUG?: boolean | string
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

	const parsedInput = JSONParse(args[0]) as Partial<Input>

	const input: Input = {...inputDefaults}
	for (const [key, value] of Object.entries(parsedInput)) {
		if (value !== '') {
			input[key] = parse(value)
		}
	}

	input.DEBUG ||= process.env.RUNNER_DEBUG === '1' || process.env.DEBUG === 'true'
	isDebug = !!input.DEBUG

	if (isDebug) {
		$.prefix = 'set -euox pipefail;'

		/* eslint-disable array-element-newline */
		// debug(`env:`, JSONPrettify(process.env))
		debug('argv', JSONPrettify(argv))
		debug('parsedInput', JSONPrettify(parsedInput))
		debug('Input', JSONPrettify(objectExcept(input, [
			'NPM_TOKEN',
			'GITHUB_TOKEN',
			'NPM_REGISTRY'
		])))
		/* eslint-enable array-element-newline */
	}

	try {
		await which(input.PACKAGE_MANAGER)
	} catch {
		die`Package manager "${input.PACKAGE_MANAGER}" not found`
	}
	const pm = [input.PACKAGE_MANAGER]
	const packageJson = getFileJSON('package.json')
	const availableScripts = Object.keys(packageJson?.scripts || {})

	secrets.NPM_TOKEN = input.NPM_TOKEN || process.env.NPM_TOKEN
	secrets.NPM_AUTH_TOKEN = secrets.NPM_TOKEN
	secrets.GITHUB_TOKEN = input.GITHUB_TOKEN || process.env.GITHUB_TOKEN
	secrets.NPM_REGISTRY = input.NPM_REGISTRY || process.env.NPM_REGISTRY || 'https://registry.npmjs.org/'

	for (const [key, value] of Object.entries(secrets)) {
		if (value) {
			$.prefix += `export ${key}="${value}";`
		}
	}

	if (secrets.NPM_TOKEN || secrets.NPM_REGISTRY) {
		log`Setup npm`
		const registry = (secrets.NPM_REGISTRY || 'https://registry.npmjs.org/')
			.replace(/^https?:\/\//, '')
			.replace(/\/$/, '')

		if (secrets.NPM_REGISTRY) {
			await $`npm config set registry ${secrets.NPM_REGISTRY}`
		}

		if (secrets.NPM_TOKEN) {
			await $`npm config set //${registry}/:_authToken ${secrets.NPM_TOKEN}`

			try {
				const res = await $`npm whoami`.quiet()
				if (res.exitCode !== 0) {
					throw new Error(res.stderr || res.stdout)
				}
				log`Authenticated with NPM registry as ${res.stdout}`
			} catch {
				die`Failed to authenticate with NPM registry`
			}
		}
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

			if (isDebug) {
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

	log`Setup git`
	await $`git config --global user.email "github-actions[bot]@users.noreply.github.com"`
	await $`git config --global user.name "github-actions[bot]"`
	await $`git config advice.ignoredHook false`

	log`Install dependencies`
	const installParams: string[] = []

	if (pm.includes('pnpm')) {
		installParams.push('install', `--loglevel=${isDebug ? 'debug' : 'warn'}`, '--frozen-lockfile')
	} else if (pm.includes('yarn')) {
		installParams.push('install', '--frozen-lockfile')
	} else if (pm.includes('npm')) {
		installParams.push('ci', '--no-audit', '--no-fund')
	}

	try {
		const results = await $`${pm} ${installParams}`
		if (results.exitCode === 0) {
			success`Dependencies installed`
		}
	} catch (error: any) {
		if (error.stdout.includes('ERR_PNPM_OUTDATED_LOCKFILE') && input.AUTOFIX_LOCKFILE) {
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
			die`Error installing dependencies ${error.stdout}`
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
		log`Committing changes`
		const gitStatus = await $`git status --porcelain`
		if (gitStatus.stdout) {
			const paths = input.AUTO_COMMIT === true ? '.' : input.AUTO_COMMIT
			await $`git add ${paths}`
			await $`git commit -m "chore: update files modified by CI [skip ci]"`
			await $`git push`
		}
	}
}

main().then(() => {
	success`Finished`
	process.exit(0)
}).catch(error => {
	die`${error}`
})
