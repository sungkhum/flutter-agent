#!/usr/bin/env node

import pc from 'picocolors'
import { runAgentsMd, type AgentsMdOptions } from './agents-md'

function printHelp(): void {
  console.log(
    [
      'Usage: flutter-agent <command> [options]',
      '',
      'Commands:',
      '  agents-md   Download docs and inject a compressed index into AGENTS.md/CLAUDE.md',
      '',
      'Options:',
      '  --version <version>  Flutter version (metadata only)',
      '  --ref <git-ref>      Docs repo git ref (branch/tag/commit)',
      '  --output <files>     Target markdown file(s), comma-separated',
      '  -h, --help           Show help',
      '',
      'Examples:',
      '  npx github:sungkhum/flutter-agent agents-md',
      '  npx github:sungkhum/flutter-agent agents-md --version 3.24.0',
      '  npx github:sungkhum/flutter-agent agents-md --ref main',
      '  npx github:sungkhum/flutter-agent agents-md --output AGENTS.md,CLAUDE.md',
    ].join('\n')
  )
}

function parseOptions(args: string[]): AgentsMdOptions {
  const options: AgentsMdOptions = {}

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]

    if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }

    if (arg === '--version' || arg === '-v') {
      const value = args[i + 1]
      if (!value) {
        throw new Error('Missing value for --version')
      }
      options.version = value
      i += 1
      continue
    }

    if (arg.startsWith('--version=')) {
      options.version = arg.split('=', 2)[1]
      continue
    }

    if (arg === '--ref' || arg === '-r') {
      const value = args[i + 1]
      if (!value) {
        throw new Error('Missing value for --ref')
      }
      options.ref = value
      i += 1
      continue
    }

    if (arg.startsWith('--ref=')) {
      options.ref = arg.split('=', 2)[1]
      continue
    }

    if (arg === '--output' || arg === '-o') {
      const value = args[i + 1]
      if (!value) {
        throw new Error('Missing value for --output')
      }
      options.output = value
      i += 1
      continue
    }

    if (arg.startsWith('--output=')) {
      options.output = arg.split('=', 2)[1]
      continue
    }

    throw new Error(`Unknown option: ${arg}`)
  }

  return options
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2)

  if (!command || command === '--help' || command === '-h') {
    printHelp()
    process.exit(0)
  }

  if (command !== 'agents-md') {
    console.error(pc.red(`Unknown command: ${command}`))
    printHelp()
    process.exit(1)
  }

  try {
    const options = parseOptions(rest)
    await runAgentsMd(options)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(pc.red(message))
    process.exit(1)
  }
}

main()
