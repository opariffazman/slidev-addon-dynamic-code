import lz from 'lz-string'
import { originHash } from './hash'

export interface EmitInput {
  id: string
  lang: string
  code: string
  ranges: string[] | null
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function emitDynamicCode(input: EmitInput): Promise<string> {
  const hash = await originHash(input.code)
  const encoded = lz.compressToBase64(input.code)
  const rangesAttr = input.ranges?.length
    ? ` :ranges='${JSON.stringify(input.ranges)}'`
    : ''
  return `<DynamicCode id="${escapeAttr(input.id)}" lang="${escapeAttr(input.lang)}" origin-hash="${hash}" code-lz="${encoded}"${rangesAttr} />`
}
