#!/usr/bin/env zx
import {isString} from '@snickbit/utilities'
import {isDebug, useSecrets} from '@/config.js'

function stringify(arg: ProcessOutput | any) {
	if (arg instanceof ProcessOutput) {
		return arg.toString().replace(/\n$/, '')
	}
	return `${arg}`
}

const stripSecrets = (msg: string) => {
	const secrets = useSecrets()
	for (const [name, value] of Object.entries(secrets)) {
		if (value) {
			msg = msg.replace(value, isDebug() ? chalk.white.bold(`{{${chalk.yellow(name)}}}`) : '***')
		}
	}

	return msg
}
const write = (prefix: string, pieces: TemplateStringsArray, ...args: any[]) => {
	const lastIdx = pieces.length - 1
	const msg = Array.isArray(pieces) && pieces.every(element => isString(element)) && lastIdx === args.length
		? args.map((arg, argIndex) => pieces[argIndex] + stringify(arg)).join('') + pieces[lastIdx]
		: [pieces, ...args].map(element => stringify(element)).join(' ')

	console.log(stripSecrets(msg))
}

export function out(pieces, ...args) {
	write(chalk.white(`[LOG]`), pieces, ...args)
}

out.info = (pieces, ...args) => {
	write(chalk.blue(`[INFO]`), pieces, ...args)
}

out.success = (pieces, ...args) => {
	write(chalk.green(`[SUCCESS]`), pieces, ...args)
}
out.debug = (pieces, ...args) => {
	if (isDebug()) {
		write(chalk.yellow(`[DEBUG]`), pieces, ...args)
	}
}
out.error = (pieces, ...args) => {
	write(chalk.red(`[ERROR]`), pieces, ...args)
}
export const die = (pieces, ...args) => {
	write(chalk.red(`[DIE]`), pieces, ...args)
	process.exit(1)
}

out.die = die

