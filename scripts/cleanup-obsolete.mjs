import { readdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

// robocopy /E intentionally preserves files that are not present in the new source tree.
// Keep that safe copy behavior, then remove only files that this project has explicitly retired.
const obsoletePaths = [
  'src/services/relationshipService.ts'
]

const retiredDocNames = new Set([
  'COMMUNITY_JSON_COMPAT_V0.4.3.4.md',
  'COMMUNITY_UI_PRIORITY_V0.4.3.6.md',
  'COMMUNITY_USER_RESOLVER_V0.4.3.5.md',
  'README_docs说明.md',
  '开发日志.md',
  '聊天有用内容.md',
  '部署GitHub方法.md'
])

const removed = []
for (const relativePath of obsoletePaths) {
  const target = resolve(root, relativePath)
  try {
    await rm(target)
    removed.push(relativePath)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

const docsDir = resolve(root, 'docs')
for (const entry of await readdir(docsDir, { withFileTypes: true })) {
  if (!entry.isFile()) continue
  const name = entry.name
  // V0.2.0_... / V0.4.3.7.4.1_... are archived into RELEASE_HISTORY.md.
  const archivedReleaseNote = /^V0(?:\.\d+)+_.+\.md$/i.test(name)
  if (!archivedReleaseNote && !retiredDocNames.has(name)) continue
  await rm(resolve(docsDir, name), { force: true })
  removed.push(`docs/${name}`)
}

console.log(`[cleanup] retired files removed: ${removed.length}`)
