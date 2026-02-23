# flutter-agent

Flutter documentation index generator for AI coding agents. Mirrors the workflow of `npx @next/codemod agents-md` but targets Flutter.

## Usage

```bash
npx github:sungkhum/flutter-agent agents-md
npx github:sungkhum/flutter-agent agents-md --version 3.24.0
npx github:sungkhum/flutter-agent agents-md --ref main
npx github:sungkhum/flutter-agent agents-md --output AGENTS.md,CLAUDE.md
```

This will:
- Download the Flutter docs into `.flutter-docs/` (indexes `src/content/docs/` or `src/content/docs/en/` when present)
- Build a compact index of markdown files
- Inject it into your target markdown file(s) (prompted if `--output` is omitted). `CLAUDE.md` receives a compact index.
- Save the full index at `.flutter-docs-index/full.index.txt`
- Add `.flutter-docs/` and `.flutter-docs-index/` to `.gitignore` if missing

## Version support

If you omit `--version` and `--ref`, the CLI will try to detect the Flutter version from common local sources:
- `.fvm/fvm_config.json`
- `.fvmrc`
- `.tool-versions`

Because the official docs are maintained on the main branch of the docs repo, `--version` is treated as metadata (for the index). Use `--ref` to pin a specific docs branch, tag, or commit when needed.

## Custom docs

Place additional markdown files under `.flutter-docs-extra/`. When you run `agents-md`, the contents are copied into `.flutter-docs/` before indexing.

## Local development

```bash
npm install
npm run build
node dist/cli/index.js agents-md
```

## License

MIT
