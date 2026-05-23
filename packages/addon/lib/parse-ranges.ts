const TOKEN_RE = /^(?:\*|all|hide|\d+(?:-\d+)?)$/

export function parseRangeSteps(s: string | null): string[] | null {
  if (s == null)
    return null
  const trimmed = s.trim()
  if (!trimmed)
    return null
  const steps = trimmed.split('|').map(seg => seg.trim())
  if (steps.length === 0 || steps.some(seg => seg === ''))
    return null
  for (const step of steps) {
    const tokens = step.split(',').map(t => t.trim())
    if (tokens.length === 0 || tokens.some(t => !TOKEN_RE.test(t)))
      return null
  }
  return steps
}

export function parseHighlightRange(spec: string, lineCount: number): Set<number> {
  const out = new Set<number>()
  const trimmed = spec.trim()
  if (trimmed === 'all' || trimmed === '*' || trimmed === 'hide')
    return out
  for (const tok of trimmed.split(',')) {
    const t = tok.trim()
    if (!t)
      continue
    const dash = t.indexOf('-')
    if (dash > 0) {
      const a = Number.parseInt(t.slice(0, dash), 10)
      const b = Number.parseInt(t.slice(dash + 1), 10)
      if (!Number.isFinite(a) || !Number.isFinite(b))
        continue
      const lo = Math.min(a, b)
      const hi = Math.max(a, b)
      for (let i = lo; i <= hi; i++) {
        if (i >= 1 && i <= lineCount)
          out.add(i)
      }
    }
    else {
      const n = Number.parseInt(t, 10)
      if (Number.isFinite(n) && n >= 1 && n <= lineCount)
        out.add(n)
    }
  }
  return out
}
