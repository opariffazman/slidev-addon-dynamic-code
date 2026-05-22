const RE_OUTER = /^([\w'-]+)?\s*\{dynamic([^}]*)\}\s*(\{[^}]*\})?/
const RE_ID = /^\s+id=([\w-]+)\s*$/

export interface DynamicDirective {
  lang: string
  id: string | null
  extraMeta: string | null
}

export function parseDynamicDirective(info: string): DynamicDirective | null {
  const trimmed = info.trim()
  if (!trimmed.includes('{dynamic'))
    return null
  const match = trimmed.match(RE_OUTER)
  if (!match)
    return null
  const [, lang = '', innerContent = '', extraMeta] = match
  const idMatch = innerContent.match(RE_ID)
  const id = idMatch ? idMatch[1]! : null
  return { lang, id, extraMeta: extraMeta || null }
}
