#!/usr/bin/env zx

import {die, out} from '@/output.js'
import {isDebug, isGitReady, requiresGit, setGitReady, useInput, usePm, useSecrets} from '@/config.js'
import {pnx, whoAmI} from '@/npm.js'
import 'zx/globals'

$.verbose = false

async function main() {
	const input = useInput()

	const secrets = useSecrets()

	secrets.NPM_TOKEN = input.NPM_TOKEN || process.env.NPM_TOKEN
	secrets.NPM_AUTH_TOKEN = secrets.NPM_TOKEN
	secrets.GITHUB_TOKEN = input.GITHUB_TOKEN || process.env.GITHUB_TOKEN
	secrets.NPM_REGISTRY = input.NPM_REGISTRY || process.env.NPM_REGISTRY || 'https://registry.npmjs.org/'
	secrets.NPM_REGISTRY_DOMAIN = (secrets.NPM_REGISTRY || 'https://registry.npmjs.org/')
		.replace(/^https?:\/\//, '')
		.replace(/\/$/, '')

	secrets.NPM_REGISTRY_SCOPE = input.NPM_REGISTRY_SCOPE || process.env.NPM_REGISTRY_SCOPE
	if (secrets.NPM_REGISTRY_SCOPE && !secrets.NPM_REGISTRY_SCOPE.startsWith('@')) {
		secrets.NPM_REGISTRY_SCOPE = `@${secrets.NPM_REGISTRY_SCOPE}`
	}

	for (const [key, value] of Object.entries(secrets)) {
		if (value) {
			$.prefix += `export ${key}="${value}";`
		}
	}

	if ((secrets.NPM_TOKEN || secrets.NPM_REGISTRY) && !(await whoAmI())) {
		out.info`Setup npm`

		const configPairs: string[] = []

		if (secrets.NPM_REGISTRY) {
			if (secrets.NPM_REGISTRY_SCOPE) {
				configPairs.push(`${secrets.NPM_REGISTRY_SCOPE}:registry=${secrets.NPM_REGISTRY}`)
			} else {
				configPairs.push(`registry=${secrets.NPM_REGISTRY}`)
			}
		}

		if (secrets.NPM_TOKEN) {
			configPairs.push(`//${secrets.NPM_REGISTRY_DOMAIN}/:_authToken=${secrets.NPM_TOKEN}`)
		}

		if (configPairs.length > 0) {
			await $`npm config set ${configPairs}`.quiet()
		}

		const npmConfig = await $`npm config list`.quiet()
		out.debug`NPM config: ${npmConfig}`

		if (secrets.NPM_TOKEN) {
			const username = await whoAmI()

			if (username) {
				out`Authenticated with NPM registry as ${username.slice(0, 1)}${'*'.repeat(username.length - 2)}${username.slice(-1)}`
			} else {
				die`Failed to authenticate with NPM registry`
			}
		}
	}

	const pm = [await usePm()]

	if (requiresGit()) {
		out.info`Setup git`
		await $`git config --global user.email "github-actions[bot]@users.noreply.github.com"`
		await $`git config --global user.name "github-actions[bot]"`
		await $`git config advice.ignoredHook false`
		setGitReady()
	}

	out.info`Install dependencies`
	const installParams: string[] = []

	if (pm.includes('pnpm')) {
		installParams.push('install', `--loglevel=${isDebug() ? 'debug' : 'warn'}`, '--frozen-lockfile')
	} else if (pm.includes('yarn')) {
		installParams.push('install', '--frozen-lockfile')
	} else if (pm.includes('npm')) {
		installParams.push('ci', '--no-audit', '--no-fund')
	}

	try {
		const results = await $`${pm} ${installParams}`
		if (results.exitCode === 0) {
			out.success`Dependencies installed`
		}
	} catch (error: any) {
		if (error.stdout.includes('ERR_PNPM_OUTDATED_LOCKFILE') && input.AUTOFIX_LOCKFILE && isGitReady()) {
			out.debug`Updating lockfile`
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

	for (const script of input.SCRIPTS.split(',')) {
		await pnx(script)
	}

	if (isGitReady()) {
		if (input.BAIL_ON_DIRTY) {
			const gitStatus = await $`git status --porcelain`
			if (gitStatus.stdout) {
				const bailOnDirty = input.BAIL_ON_DIRTY === true ? 'true' : input.BAIL_ON_DIRTY
				die`${bailOnDirty} ${gitStatus.stdout}`
			}
		} else if (input.AUTO_COMMIT) {
			out`Committing changes`
			const gitStatus = await $`git status --porcelain`
			if (gitStatus.stdout) {
				const paths = input.AUTO_COMMIT === true ? '.' : input.AUTO_COMMIT
				await $`git add ${paths}`
				await $`git commit -m "chore: update files modified by CI [skip ci]"`
				await $`git push`
			}
		}
	}
}

main().then(() => {
	out.success`Finished`
	process.exit(0)
}).catch(error => {
	die`${error}`
})
