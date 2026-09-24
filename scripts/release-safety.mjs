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

  const coupleBoardView = await readText('src/views/CoupleBoardView.vue')
  const coupleBoardService = await readText('src/services/coupleBoardGameService.ts')
  if (coupleBoardView.includes('setPointerCapture') || coupleBoardView.includes('suppressCharacterClick')) {
    fail('Couple Board character picker must not capture pointer taps or suppress character clicks')
  }
  if (coupleBoardView.includes('structuredClone(') || coupleBoardService.includes('structuredClone(')) {
    fail('Couple Board runtime must not structuredClone Vue reactive proxies')
  }
  if (!coupleBoardView.includes("type=\"button\" class=\"character-chip\"") || !coupleBoardView.includes('@click="chooseCharacter(character.id)"')) {
    fail('Couple Board character chips must remain native clickable buttons')
  }
  if (!coupleBoardService.includes('cloneCoupleBoardGame')) {
    fail('Couple Board must normalize reactive snapshots before persistence and game transitions')
  }
  pass('Couple Board tap/resume/clone regressions are guarded')
  if (!coupleBoardService.includes('export type CoupleBoardIntensity = 1 | 2 | 3 | 4 | 5') ||
      !coupleBoardService.includes("private: '私房'") ||
      !coupleBoardView.includes("value: 5, title: '私房'")) {
    fail('Couple Board V1.4 must keep the adult-only L5 private tier wired through service and UI')
  }
  pass('Couple Board L5 private tier is wired through service and UI')

  const coupleBoardInteraction = await readText('src/services/coupleBoardInteractionService.ts')
  const coupleBoardMemoryBridge = await readText('src/services/coupleBoardMemoryBridge.ts')
  const coupleBoardMemoryPrompt = await readText('src/services/coupleBoardMemoryPromptService.ts')
  const coupleBoardMap = await readText('src/services/coupleBoardMapService.ts')
  if (!coupleBoardView.includes('COUPLE BOARD · V2.3 ALPHA') ||
      !coupleBoardView.includes('CoupleBoardPixelSprite') ||
      !coupleBoardView.includes('syncCoupleBoardInteractionMemory')) {
    fail('Couple Board V2 immersive UI / pixel sprite / Memory Bridge must stay wired')
  }
  if (!coupleBoardInteraction.includes('角色一致性是最高优先级') ||
      !coupleBoardInteraction.includes('memoryEvidenceIds') ||
      !coupleBoardInteraction.includes('游戏氛围不能覆盖原角色设定') ||
      !coupleBoardInteraction.includes('buildCoupleBoardReplyAuditMessages') ||
      !coupleBoardInteraction.includes('roleConsistencyChecked')) {
    fail('Couple Board V2 must keep role-card-first, evidence-bound generation and role-continuity audit')
  }
  if (!coupleBoardMemoryBridge.includes("layer: 'shared'") ||
      !coupleBoardMemoryBridge.includes("scope: 'character'") ||
      !coupleBoardMemoryBridge.includes("kind !== 'stable'")) {
    fail('Couple Board V2 Memory Bridge must persist real shared interactions and reject hypothetical/transient semantic memories')
  }
  if (!coupleBoardMap.includes('COUPLE_BOARD_MAP_STOPS') || !coupleBoardMap.includes("name: '床边'")) {
    fail('Couple Board V2 themed 30-stop date map is missing')
  }
  pass('Couple Board V2 role continuity, memory writeback and themed map are guarded')

  if (!coupleBoardView.includes("mode: 'reality'") ||
      coupleBoardView.includes("@click=\"mode = 'chat'\"") ||
      !coupleBoardView.includes('面对面互动')) {
    fail('Couple Board V2.1 must be face-to-face only in the playable UI')
  }
  if (!coupleBoardView.includes("'has-challenge': Boolean(game?.pending && pendingPrompt)") ||
      !coupleBoardView.includes('.love-game-shell.is-game.has-challenge .board-card') ||
      !coupleBoardView.includes('.challenge-backdrop{top:50.5%;bottom:0;padding:4px 10px 6px}')) {
    fail('Couple Board V2.2 must keep the fixed half-map / half-interaction layout')
  }
  if (!coupleBoardInteraction.includes('棋盘地点（例如花店、公园、电影院、床边）只是虚构棋盘格') ||
      !coupleBoardMemoryBridge.includes('仅游戏舞台')) {
    fail('Couple Board V2.1 must never turn board-stop scenery into a real-world location or memory fact')
  }
  if (!coupleBoardInteraction.includes("mode: 'face-to-face'") ||
      !coupleBoardView.includes('这题只归本轮掷骰的人') ||
      !coupleBoardView.includes('对方只负责真实回应') ||
      !coupleBoardMemoryPrompt.includes('hasDualOwnerInstruction') ||
      !coupleBoardMemoryPrompt.includes('另一方不承担这道题的回答或任务要求')) {
    fail('Couple Board V2.1 must keep each question owned by the dice roller while allowing partner reactions')
  }
  if (coupleBoardView.includes('换一题') || coupleBoardView.includes('@click="replaceChallenge"') ||
      !coupleBoardView.includes('请求跳过') || !coupleBoardView.includes('approvePartnerSkip') ||
      !coupleBoardInteraction.includes('skipDecision') || !coupleBoardInteraction.includes('requestSkip')) {
    fail('Couple Board V2.2 must forbid question replacement and require partner approval for skips')
  }
  pass('Couple Board V2.2 fixed split layout, no-replace and mutual skip-consent rules are guarded')

  const wardrobeView = await readText('src/views/WardrobeView.vue')
  const wardrobeService = await readText('src/services/avatarWardrobeService.ts')
  const avatarComponent = await readText('src/components/avatar/CompanionPixelAvatar.vue')
  if (!routerSource.includes("path: '/app/穿搭'") ||
      !appCustomizationSource.includes("key: 'wardrobe'") ||
      !appCustomizationSource.includes('HOME_LAYOUT_REVISION = 14')) {
    fail('Companion Wardrobe must keep a concrete launcher route and launcher migration')
  }
  if (!wardrobeView.includes('WARDROBE · V1.2') ||
      !wardrobeView.includes('<PhoneFrame lock-scroll>') ||
      !wardrobeView.includes('wardrobe-workbench') ||
      !wardrobeView.includes('preview-pane') ||
      !wardrobeView.includes('editor-tabs') ||
      !wardrobeView.includes('editor-scroll') ||
      !wardrobeView.includes("type=\"color\"") ||
      !wardrobeView.includes('每日自主换装') ||
      !wardrobeView.includes("changeGender('female')") ||
      !wardrobeView.includes("changeGender('male')") ||
      !wardrobeService.includes('chooseDailyOutfit') ||
      !wardrobeService.includes('rememberCustomColor') ||
      !wardrobeService.includes('HEADWEAR') ||
      !wardrobeService.includes('FACEWEAR') ||
      !wardrobeService.includes('NECKWEAR') ||
      !wardrobeService.includes('profiles: Record<string, AvatarAppearanceProfile>') ||
      !avatarComponent.includes('pixel-avatar') ||
      !avatarComponent.includes('viewBox="0 0 48 64"')) {
    fail('Wardrobe V1.2 must keep the always-visible warm pixel preview, richer clothes/accessories, free color picker and daily outfit runtime')
  }
  if (!coupleBoardView.includes(':appearance="userAppearance"') ||
      !coupleBoardView.includes(':appearance="partnerAppearance"') ||
      !coupleBoardView.includes("router.push('/app/穿搭')") ||
      !coupleBoardView.includes('.location-card{left:7px;right:auto') ||
      !coupleBoardView.includes('.love-game-shell.is-game.has-challenge .board-card{left:10px;right:10px;top:91px;bottom:49.5%')) {
    fail('Couple Board V2.3 must use wardrobe sprites, compact HUD and the enlarged fixed map')
  }
  pass('Companion Avatar V1.2 / Wardrobe V1.2 daily outfit + free color integration are guarded')

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
