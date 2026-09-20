export function collectCharacterGreetings(firstMessage?: string, alternateGreetings?: string[]) {
  const rows = [firstMessage, ...(alternateGreetings || [])]
    .map(item => item?.trim() || '')
    .filter(Boolean)
  return Array.from(new Set(rows))
}

export function hasMultipleCharacterGreetings(firstMessage?: string, alternateGreetings?: string[]) {
  return collectCharacterGreetings(firstMessage, alternateGreetings).length > 1
}
