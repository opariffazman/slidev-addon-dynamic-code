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
