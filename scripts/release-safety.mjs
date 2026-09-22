import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const defaultRoot = resolve(here, '..')
const mode = process.argv[2] ?? 'source'
const root = process.argv[3] ? resolve(process.argv[3]) : defaultRoot

const fail = (message) => {
  console.error(`[release-safety] FAIL: ${message}`)
  process.exit(1)
}

const pass = (message) => console.log(`[release-safety] OK: ${message}`)

async function readText(relativePath) {
  try {
    return await readFile(resolve(root, relativePath), 'utf8')
  } catch (error) {
    fail(`cannot read ${relativePath}: ${error?.message ?? error}`)
  }
}

function git(args, { allowFailure = false } = {}) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim()
  } catch (error) {
    if (allowFailure) return ''
    const details = String(error?.stderr ?? error?.message ?? error).trim()
    fail(`git ${args.join(' ')} failed${details ? `: ${details}` : ''}`)
  }
}

function nonEmptyLines(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
}

function isForbiddenGitPath(path) {
  const normalized = path.replaceAll('\\', '/')
  return normalized === 'node_modules' ||
    normalized.startsWith('node_modules/') ||
    normalized === 'dist' ||
    normalized.startsWith('dist/') ||
    normalized.endsWith('.tsbuildinfo') ||
    (normalized.startsWith('.env') && normalized !== '.env.example')
}

async function checkSource() {
  const packageJson = JSON.parse(await readText('package.json'))
  const packageLock = JSON.parse(await readText('package-lock.json'))
  const version = packageJson.version

  if (!version) fail('package.json has no version')
  if (packageLock.version !== version) {
    fail(`package-lock.json version ${packageLock.version} != package.json ${version}`)
  }
  if (packageLock.packages?.['']?.version !== version) {
    fail(`package-lock root version ${packageLock.packages?.['']?.version ?? '<missing>'} != ${version}`)
  }
  pass(`package metadata version ${version}`)

  const gitignore = await readText('.gitignore')
  const requiredIgnoreRules = ['node_modules/', 'dist/', '*.tsbuildinfo', '.env', '.env.*', '!.env.example']
  for (const rule of requiredIgnoreRules) {
    if (!nonEmptyLines(gitignore).includes(rule)) fail(`.gitignore missing required rule: ${rule}`)
  }
  pass('.gitignore protects dependencies, build output, tsbuildinfo and env files')

  const attributes = await readText('.gitattributes')
  if (!attributes.includes('* text=auto eol=lf')) {
    fail('.gitattributes must keep source/docs deterministic with LF')
  }
  pass('.gitattributes line-ending policy')

  const workflow = await readText('.github/workflows/deploy.yml')
  if (!workflow.includes('run: npm run verify')) {
    fail('GitHub Actions must use the same npm run verify quality gate')
  }
  pass('GitHub Actions uses npm run verify')

  const routerSource = await readText('src/router/index.ts')
  if (routerSource.includes('PlaceholderApp') || routerSource.includes("path: '/app/:name'")) {
    fail('finished app routes must not fall through to the old PlaceholderApp screen')
  }

  const appCustomizationSource = await readText('src/services/appCustomizationService.ts')
  const catalogMatch = appCustomizationSource.match(/const APP_CATALOG:[\s\S]*?= \[([\s\S]*?)\n\]/)
  if (!catalogMatch) fail('cannot audit APP_CATALOG routes')
  const launcherRoutes = [...catalogMatch[1].matchAll(/route:\s*'([^']+)'/g)].map((match) => match[1])
  if (!launcherRoutes.length) fail('APP_CATALOG has no routes to audit')
  for (const route of launcherRoutes) {
    if (!routerSource.includes(`path: '${route}'`)) fail(`launcher app has no concrete router entry: ${route}`)
  }
  for (const route of ['/app/朋友圈', '/app/海龟汤', '/app/音乐', '/app/时光', '/app/心跳飞行棋']) {
    if (!routerSource.includes(`path: '${route}'`)) fail(`missing native app route: ${route}`)
  }
  if (!routerSource.includes("path: '/:pathMatch(.*)*'") || !routerSource.includes("redirect: '/home'")) {
    fail('unknown/obsolete routes must return to Home instead of rendering a placeholder')
  }
  pass(`all ${launcherRoutes.length} launcher apps + native app routes are concrete; PlaceholderApp fallback removed`)

  const requiredDocs = [
    'docs/部署与更新.md',
    'docs/知间产品原则.md',
    'docs/START_HERE_小白启动指南.md',
    `docs/releases/V${version}_RELEASE_MANIFEST.md`,
    `docs/releases/V${version}_部署与更新.md`
  ]
  for (const relativePath of requiredDocs) await readText(relativePath)
  pass('release docs and UTF-8 Chinese filenames are present')
}

function ensureGitRepository() {
  const inside = git(['rev-parse', '--is-inside-work-tree'], { allowFailure: true })
  if (inside !== 'true') fail('current source is not inside a Git work tree')
}

function checkBranch() {
  const branch = git(['branch', '--show-current'])
  if (branch !== 'main') fail(`current branch is ${branch || '<detached>'}, expected main`)
  pass('current branch is main')
}

function checkOriginRemote() {
  const origin = git(['remote', 'get-url', 'origin'], { allowFailure: true })
  if (!origin) fail('Git remote origin is missing')
  pass(`Git remote origin: ${origin}`)
}

function checkNoTrackedIgnored() {
  const ignoredTracked = nonEmptyLines(git(['ls-files', '-ci', '--exclude-standard']))
  if (ignoredTracked.length) {
    fail(`ignored-but-tracked files exist (${ignoredTracked.length}); first: ${ignoredTracked.slice(0, 5).join(', ')}`)
  }
  pass('no ignored-but-tracked files')
}

function checkNoForbiddenTracked() {
  const tracked = nonEmptyLines(git(['ls-files']))
  const forbidden = tracked.filter(isForbiddenGitPath)
  if (forbidden.length) {
    fail(`forbidden tracked files exist (${forbidden.length}); first: ${forbidden.slice(0, 5).join(', ')}`)
  }
  pass('node_modules/dist/tsbuildinfo/env are not tracked')
}

function checkCleanWorkingTree() {
  const status = git(['status', '--porcelain'])
  if (status) fail('Git working tree is not clean')
  pass('Git working tree is clean')
}

function checkStagedArea() {
  const staged = nonEmptyLines(git(['diff', '--cached', '--name-only']))
  if (!staged.length) fail('staging area is empty')
  const forbidden = staged.filter(isForbiddenGitPath)
  if (forbidden.length) {
    fail(`forbidden paths are staged (${forbidden.length}); first: ${forbidden.slice(0, 5).join(', ')}`)
  }
  pass(`staging area contains ${staged.length} allowed file(s)`)
}

if (mode === 'source') {
  await checkSource()
  process.exit(0)
}

if (mode === 'git-working' || mode === 'staged') {
  await checkSource()
}

ensureGitRepository()
checkBranch()
checkOriginRemote()
checkNoTrackedIgnored()
checkNoForbiddenTracked()

if (mode === 'git-preflight') {
  checkCleanWorkingTree()
} else if (mode === 'git-working') {
  pass('dirty working tree allowed after source sync')
} else if (mode === 'staged') {
  checkStagedArea()
} else {
  fail(`unknown mode: ${mode}`)
}
