export async function originHash(input: string): Promise<string> {
  const trimmed = input.trim()
  const data = new TextEncoder().encode(trimmed)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(digest)
  let hex = ''
  for (let i = 0; i < 6; i++) {
    hex += bytes[i]!.toString(16).padStart(2, '0')
  }
  return hex
}
