/**
 * agents-md: Generate Flutter documentation index for AI coding agents.
 *
 * Downloads docs from GitHub, builds a compact index of all doc files,
 * and injects it into AGENTS.md or CLAUDE.md.
 */

import { execa } from 'execa'
import fs from 'fs'
import os from 'os'
import path from 'path'

export interface AgentsMdOptions {
  version?: string
  ref?: string
  output?: string
}

interface DetectResult {
  version: string | null
  source?: string
}

const DOCS_REPO_URL = 'https://github.com/flutter/website.git'
const DOCS_DIR_NAME = '.flutter-docs'
const EXTRA_DOCS_DIR_NAME = '.flutter-docs-extra'
const INDEX_DIR_NAME = '.flutter-docs-index'
const START_MARKER = '<!-- FLUTTER-AGENTS-MD-START -->'
const END_MARKER = '<!-- FLUTTER-AGENTS-MD-END -->'
const INDEX_TITLE = 'Flutter Docs Index'

export function detectFlutterVersion(cwd: string): DetectResult {
  const fvmConfigPath = path.join(cwd, '.fvm', 'fvm_config.json')
  if (fs.existsSync(fvmConfigPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(fvmConfigPath, 'utf-8'))
      const version = data?.flutterSdkVersion
      if (version) {
        return { version: String(version).trim(), source: '.fvm/fvm_config.json' }
      }
    } catch {
      // fall through
    }
  }

  const fvmrcPath = path.join(cwd, '.fvmrc')
  if (fs.existsSync(fvmrcPath)) {
    const version = fs.readFileSync(fvmrcPath, 'utf-8').trim()
    if (version) {
      return { version, source: '.fvmrc' }
    }
  }

  const toolVersionsPath = path.join(cwd, '.tool-versions')
  if (fs.existsSync(toolVersionsPath)) {
    const lines = fs.readFileSync(toolVersionsPath, 'utf-8').split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const [tool, version] = trimmed.split(/\s+/, 2)
      if (tool === 'flutter' && version) {
        return { version: version.trim(), source: '.tool-versions' }
      }
    }
  }

  return { version: null }
}

export function resolveDocsRef(ref?: string): string {
  return ref?.trim() || 'main'
}

interface PullResult {
  success: boolean
  error?: string
}

export async function pullDocs(ref: string, docsPath: string): Promise<PullResult> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flutter-agent-'))

  try {
    try {
      await execa(
        'git',
        ['clone', '--depth', '1', '--single-branch', '--branch', ref, DOCS_REPO_URL, '.'],
        { cwd: tempDir }
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('not found') || message.includes('did not match')) {
        throw new Error(`Could not find documentation for ref "${ref}".`)
      }
      throw error
    }

    const docsRoot = resolveDocsRoot(tempDir)

    if (fs.existsSync(docsPath)) {
      fs.rmSync(docsPath, { recursive: true })
    }

    fs.cpSync(docsRoot, docsPath, { recursive: true })

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true })
    }
  }
}

export function mergeExtraDocs(cwd: string, docsPath: string): boolean {
  const extraDocsPath = path.join(cwd, EXTRA_DOCS_DIR_NAME)
  if (!fs.existsSync(extraDocsPath)) return false

  const entries = fs.readdirSync(extraDocsPath)
  for (const entry of entries) {
    const source = path.join(extraDocsPath, entry)
    const destination = path.join(docsPath, entry)

    if (fs.existsSync(destination)) {
      fs.rmSync(destination, { recursive: true, force: true })
    }

    fs.cpSync(source, destination, { recursive: true })
  }

  return true
}

export function resolveDocsRoot(docsPath: string): string {
  const candidates = [
    path.join(docsPath, 'src', 'content', 'docs', 'en'),
    path.join(docsPath, 'src', 'content', 'docs'),
    path.join(docsPath, 'site', 'src', 'content', 'docs', 'en'),
    path.join(docsPath, 'site', 'src', 'content', 'docs'),
    path.join(docsPath, 'src', 'content'),
    path.join(docsPath, 'site', 'src', 'content'),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return docsPath
}

export function collectDocFiles(dir: string): { relativePath: string }[] {
  return (fs.readdirSync(dir, { recursive: true }) as string[])
    .filter(
      (f) =>
        (f.endsWith('.md') || f.endsWith('.mdx')) &&
        !/[/\\]index\.mdx$/.test(f) &&
        !/[/\\]index\.md$/.test(f) &&
        !f.startsWith('index.')
    )
    .sort()
    .map((f) => ({ relativePath: f.replace(/\\/g, '/') }))
}

interface DocSection {
  name: string
  files: { relativePath: string }[]
  subsections: DocSection[]
}

export function buildDocTree(files: { relativePath: string }[]): DocSection[] {
  const sections: Map<string, DocSection> = new Map()

  for (const file of files) {
    const parts = file.relativePath.split(/[/\\]/)
    if (parts.length === 1) {
      const rootKey = '.'
      if (!sections.has(rootKey)) {
        sections.set(rootKey, {
          name: rootKey,
          files: [],
          subsections: [],
        })
      }
      sections.get(rootKey)!.files.push({ relativePath: file.relativePath })
      continue
    }

    const topLevelDir = parts[0]

    if (!sections.has(topLevelDir)) {
      sections.set(topLevelDir, {
        name: topLevelDir,
        files: [],
        subsections: [],
      })
    }

    const section = sections.get(topLevelDir)!

    if (parts.length === 2) {
      section.files.push({ relativePath: file.relativePath })
    } else {
      const subsectionDir = parts[1]
      let subsection = section.subsections.find((s) => s.name === subsectionDir)

      if (!subsection) {
        subsection = { name: subsectionDir, files: [], subsections: [] }
        section.subsections.push(subsection)
      }

      if (parts.length === 3) {
        subsection.files.push({ relativePath: file.relativePath })
      } else {
        const subSubDir = parts[2]
        let subSubsection = subsection.subsections.find(
          (s) => s.name === subSubDir
        )

        if (!subSubsection) {
          subSubsection = { name: subSubDir, files: [], subsections: [] }
          subsection.subsections.push(subSubsection)
        }

        subSubsection.files.push({ relativePath: file.relativePath })
      }
    }
  }

  const sortedSections = Array.from(sections.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  )

  for (const section of sortedSections) {
    section.files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
    section.subsections.sort((a, b) => a.name.localeCompare(b.name))
    for (const subsection of section.subsections) {
      subsection.files.sort((a, b) =>
        a.relativePath.localeCompare(b.relativePath)
      )
      subsection.subsections.sort((a, b) => a.name.localeCompare(b.name))
    }
  }

  return sortedSections
}

function collectAllFilesFromSections(sections: DocSection[]): string[] {
  const files: string[] = []

  for (const section of sections) {
    for (const file of section.files) {
      files.push(file.relativePath)
    }
    files.push(...collectAllFilesFromSections(section.subsections))
  }

  return files
}

function groupByDirectory(files: string[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>()

  for (const filePath of files) {
    const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
    const dir = lastSlash === -1 ? '.' : filePath.slice(0, lastSlash)
    const fileName = lastSlash === -1 ? filePath : filePath.slice(lastSlash + 1)

    const existing = grouped.get(dir)
    if (existing) {
      existing.push(fileName)
    } else {
      grouped.set(dir, [fileName])
    }
  }

  return grouped
}

function countSectionFiles(section: DocSection): number {
  let total = section.files.length
  for (const subsection of section.subsections) {
    total += countSectionFiles(subsection)
  }
  return total
}

type IndexMode = 'full' | 'compact'

interface IndexData {
  docsPath: string
  sections: DocSection[]
  outputFile: string
  mode?: IndexMode
  fullIndexPath?: string
  version?: string
  versionSource?: string
}

export function generateDocsIndex(data: IndexData): string {
  const {
    docsPath,
    sections,
    outputFile,
    mode = 'full',
    fullIndexPath = `./${INDEX_DIR_NAME}/full.index.txt`,
    version,
    versionSource,
  } = data

  const parts: string[] = []

  parts.push(`[${INDEX_TITLE}]`)
  parts.push(`root: ${docsPath}`)
  if (version) {
    parts.push(`version: ${version}${versionSource ? ` (${versionSource})` : ''}`)
  }
  parts.push(
    'STOP. What you remember about Flutter is WRONG for this project. Always search docs and read before any task.'
  )
  parts.push(
    `If docs missing, run this command first: npx github:sungkhum/flutter-agent agents-md --output ${outputFile}`
  )

  if (mode === 'compact') {
    const compact = sections.map((section) => {
      const count = countSectionFiles(section)
      const label = section.name === '.' ? 'root' : section.name
      return `${label}(${count})`
    })
    parts.push(`sections:{${compact.join(',')}}`)
    parts.push(`full_index: ${fullIndexPath}`)
  } else {
    const allFiles = collectAllFilesFromSections(sections)
    const grouped = groupByDirectory(allFiles)

    for (const [dir, files] of grouped) {
      parts.push(`${dir}:{${files.join(',')}}`)
    }
  }

  return parts.join('|')
}

export function injectIndex(targetContent: string, indexContent: string): string {
  const wrappedContent = `${START_MARKER}\n${indexContent}\n${END_MARKER}`

  if (targetContent.includes(START_MARKER)) {
    const startIdx = targetContent.indexOf(START_MARKER)
    const endIdx = targetContent.indexOf(END_MARKER) + END_MARKER.length

    return (
      targetContent.slice(0, startIdx) +
      wrappedContent +
      targetContent.slice(endIdx)
    )
  }

  const separator = targetContent.endsWith('\n') ? '\n' : '\n\n'
  return targetContent + separator + wrappedContent + '\n'
}

export interface GitignoreStatus {
  path: string
  updated: boolean
  alreadyPresent: boolean
}

export function ensureGitignoreEntryFor(cwd: string, entry: string): GitignoreStatus {
  const gitignorePath = path.join(cwd, '.gitignore')
  const entryRegex = new RegExp(`^\\s*${escapeRegex(entry)}(?:/.*)?$`)

  let content = ''
  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, 'utf-8')
  }

  const hasEntry = content.split(/\r?\n/).some((line) => entryRegex.test(line))

  if (hasEntry) {
    return { path: gitignorePath, updated: false, alreadyPresent: true }
  }

  const needsNewline = content.length > 0 && !content.endsWith('\n')
  const header = content.includes('# flutter-agent') ? '' : '# flutter-agent\n'
  const newContent = content + (needsNewline ? '\n' : '') + header + `${entry}/\n`

  fs.writeFileSync(gitignorePath, newContent, 'utf-8')

  return { path: gitignorePath, updated: true, alreadyPresent: false }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

 
