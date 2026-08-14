export function renderRoleplayText(
  value: string | undefined,
  userName?: string,
  characterName?: string
): string | undefined {
  if (!value) return value
  return value
    .replace(/\{\{\s*user\s*\}\}/gi, userName?.trim() || '你')
    .replace(/\{\{\s*char\s*\}\}/gi, characterName?.trim() || '角色')
}
