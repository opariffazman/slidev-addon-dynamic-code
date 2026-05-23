import { parseRangeSteps } from './parse-ranges'

const RE_OUTER = /^([\w'-]+)?\s*\{dynamic([^}]*)\}\s*(?:\{([^}]*)\})?/
const RE_ID = /^\s+id=([\w-]+)\s*$/

export interface DynamicDirective {
  lang: string
  id: string | null
  ranges: string[] | null
}

export function parseDynamicDirective(info: string): DynamicDirective | null {
  const trimmed = info.trim()
  if (!trimmed.includes('{dynamic'))
    return null
  const match = trimmed.match(RE_OUTER)
  if (!match)
    return null
  const [, lang = '', innerContent = '', extrasContent] = match
  const idMatch = innerContent.match(RE_ID)
  const id = idMatch ? idMatch[1]! : null

  let ranges: string[] | null = null
  if (extrasContent != null) {
    ranges = parseRangeSteps(extrasContent)
    if (ranges == null) {
      console.warn(
        `[dynamic-code] id="${id ?? '<missing>'}": ignored unsupported extras "{${extrasContent}}" — only line-highlight syntax {n|m|all} is supported on dynamic blocks in v0.2.0`,
      )
    }
  }

  return { lang, id, ranges }
}
