import {JSONParse, JSONPrettify, objectExcept, parse} from '@snickbit/utilities'
import {die, out} from '@/output.js'
import {getFileJSON} from '@snickbit/node-utilities'

interface State {
	isDebug: boolean
	gitReady: boolean
	input?: Input
	secrets: Record<string, any>
	pm?: 'npm' | 'pnpm' | 'yarn'
	packageJSON?: Record<string, any>
	availableScripts?: string[]
}

const state: State = {
	isDebug: false,
	gitReady: false,
	secrets: {}
}

export function useSecrets() {
	return state.secrets
}

export function setDebug(debug: boolean) {
	state.isDebug = debug
}

export function isDebug() {
	return state.isDebug
}

export function isGitReady() {
	return state.gitReady
}

export function setGitReady(ready = true) {
	state.gitReady = ready
}

export enum InputKeys {
	PACKAGE_MANAGER = 'PACKAGE_MANAGER',
	SCRIPTS = 'SCRIPTS',
	NO_BAIL = 'NO_BAIL',
	BAIL_ON_MISSING = 'BAIL_ON_MISSING',
	AUTOFIX_LOCKFILE = 'AUTOFIX_LOCKFILE',
	AUTOFIX_LINT = 'AUTOFIX_LINT',
	BAIL_ON_DIRTY = 'BAIL_ON_DIRTY',
	AUTO_COMMIT = 'AUTO_COMMIT',
	DEBUG = 'DEBUG',
	GITHUB_TOKEN = 'GITHUB_TOKEN',
	NPM_REGISTRY = 'NPM_REGISTRY',
	NPM_TOKEN = 'NPM_TOKEN',
	NPM_REGISTRY_SCOPE = 'NPM_REGISTRY_SCOPE',
	PREVENT_COMMITS = 'PREVENT_COMMITS',
	PNPM_VERSION = 'PNPM_VERSION'
}

const inputActionRequiresGit = new Set([
	'AUTOFIX_LOCKFILE',
	'AUTOFIX_LINT',
	'BAIL_ON_DIRTY',
	'AUTO_COMMIT'
])

type MappedInput = {
	[key in InputKeys]?: boolean | string
}

interface Input extends MappedInput {
	PACKAGE_MANAGER: 'npm' | 'pnpm' | 'yarn'
	SCRIPTS: string
	NO_BAIL: boolean
	BAIL_ON_MISSING: boolean
	AUTOFIX_LOCKFILE: boolean
	GITHUB_TOKEN?: string
	NPM_REGISTRY?: string
	NPM_TOKEN?: string
	NPM_REGISTRY_SCOPE?: string
	PREVENT_COMMITS?: boolean
	PNPM_VERSION?: string
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
	NPM_TOKEN: process.env.NPM_TOKEN || process.env.NPM_AUTH_TOKEN,
	NPM_REGISTRY_SCOPE: process.env.NPM_REGISTRY_SCOPE,
	PNPM_VERSION: process.env.PNPM_VERSION ?? '9'
}

export function useInput() {
	if (!state.input) {
		state.input = {...inputDefaults}

		const args = argv._

		const parsedInput = JSONParse(args[0]) as Partial<Input>

		for (const [key, value] of Object.entries(parsedInput)) {
			if (value !== '') {
				state.input[key] = parse(value)
			}
		}

		state.input.DEBUG ||= process.env.RUNNER_DEBUG === '1' || process.env.DEBUG === 'true'
		setDebug(!!state.input.DEBUG)

		if (isDebug()) {
			$.prefix = 'set -euox pipefail;'
			$.verbose = true

			/* eslint-disable array-element-newline */
			out.debug('argv', JSONPrettify(argv))
			out.debug('parsedInput', JSONPrettify(parsedInput))
			out.debug('Input', JSONPrettify(objectExcept(state.input, [
				'NPM_TOKEN',
				'GITHUB_TOKEN',
				'NPM_REGISTRY',
				'NPM_REGISTRY_SCOPE'
			])))
			/* eslint-enable array-element-newline */
		}
	}

	return state.input
}

export async function usePm() {
	if (!state.pm) {
		const input = useInput()
		try {
			await which(input.PACKAGE_MANAGER)
		} catch {
			die`Package manager "${input.PACKAGE_MANAGER}" not found`
		}
		state.pm = input.PACKAGE_MANAGER
		state.packageJSON = getFileJSON('package.json')
		state.availableScripts = Object.keys(state.packageJSON?.scripts || {})
	}

	return state.pm
}

export const hasScript = scriptName => {
	return state.availableScripts?.includes(scriptName)
}

export const requiresGit = (name?: string) => {
	if (name) {
		return inputActionRequiresGit.has(name)
	}
	const input = useInput()
	if (!input || input.PREVENT_COMMITS) {
		return false
	}

	for (const [key, value] of Object.entries(input)) {
		if (inputActionRequiresGit.has(key) && !!value) {
			return true
		}
	}
}
