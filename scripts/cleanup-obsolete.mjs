import { rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

// robocopy /E 会保留目标目录里已经从新版本源码删除的旧文件。
// 这里只清理明确退休、且继续存在会参与 TypeScript 编译的历史源码。
const obsoletePaths = [
  'src/services/relationshipService.ts'
]

for (const relativePath of obsoletePaths) {
  const target = resolve(root, relativePath)
  await rm(target, { force: true })
}
