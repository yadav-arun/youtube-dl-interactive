#!/usr/bin/env node
'use strict'
const meow = require('meow')
const logSymbols = require('log-symbols')
const shell = require('shelljs')
const parseColumns = require('parse-columns')
const ora = require('ora')
const updateNotifier = require('update-notifier')
const questions = require('./questions')
const pkg = require('./package.json')

const cli = meow(`Usage: youtube-dl-interactive URL
	 `)

async function init(args) {
	if (!shell.which('youtube-dl')) {
		shell.echo('Sorry, this script requires youtube-dl.')
		shell.echo('See https://github.com/ytdl-org/youtube-dl.')
		shell.exit(1)
	}

	updateNotifier({pkg}).notify()

	if (args.length !== 1) {
		cli.showHelp(1)
	}

	const url = args[0]

	const formatSelection = await selectFormat(url)
	if (formatSelection) {
		let options = '-f ' + formatSelection.format
		if (await questions.askIncludeSubs()) {
			options += ' --all-subs --embed-subs'
		}

		console.log(
			logSymbols.success,
			`OK, downloading format #${formatSelection.format} (${formatSelection.note})` 
		)
		shell.exec(`youtube-dl ${options} "${url}"`)
	}
}

init(cli.input).catch(error => {
	console.error(logSymbols.error, error)
	process.exit(1)
})

async function selectFormat(url) {
	const formats = await fetchFormatOptions(url)
	if (!formats) {
		return null
	}

	let remainingFormats = formats

	// By default, we ignore 'video only' files
	remainingFormats = remainingFormats.filter(
		f => f.note.indexOf('video only') === -1
	)

	remainingFormats = await questions.filterByProperty(
		'Select resolution:',
		'resolution',
		remainingFormats
	)

	remainingFormats = await questions.filterByProperty(
		'Select extension:',
		'extension',
		remainingFormats
	)

	if (remainingFormats.length > 1) {
		return questions.selectOne(remainingFormats)
	}

	return remainingFormats[0]
}

async function fetchFormatOptions(url) {
	const spinner = ora('Loading formats').start()
	const run = shell.exec(`youtube-dl -F "${url}"`, {silent: true})

	if (run.code !== 0) {
		spinner.fail('youtube-dl stopped with error:')
		console.log(run.stdout)
		console.error(run.stderr)
		return null
	}

	const qualitiesOutput = run.stdout
	spinner.stop()

	const withoutLogs = skipLogsInStdout(qualitiesOutput)
	return parseColumns(withoutLogs, {})
}

function skipLogsInStdout(qualitiesOutput) {
	return qualitiesOutput
		.split('\n')
		.filter(line => line.indexOf('[') !== 0)
		.join('\n')
}
