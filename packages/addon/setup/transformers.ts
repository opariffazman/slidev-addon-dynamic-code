import type { ResolvedSlidevOptions, SlideInfo } from '@slidev/types'
import { defineTransformersSetup } from '@slidev/types'
import { emitDynamicCode } from '../lib/emit'
import { parseDynamicDirective } from '../lib/parse-directive'
import { getIdRegistry } from '../lib/registry'

export interface CodeblockTransformerCtx {
  info: string
  code: string
  fence: number
  slide: Pick<SlideInfo, 'index'>
  options: ResolvedSlidevOptions
  renderHighlighted: () => Promise<string>
}

export type CodeblockTransformer = (ctx: CodeblockTransformerCtx) => Promise<string | null>

export function createDynamicCodeTransformer(): CodeblockTransformer {
  return async (ctx) => {
    const parsed = parseDynamicDirective(ctx.info)
    if (!parsed)
      return null

    const slideNo = (ctx.slide?.index ?? -1) + 1

    if (!parsed.id) {
      throw new Error(`[dynamic-code] missing required id=NAME on slide ${slideNo} — use {dynamic id=install-deps}`)
    }

    const registry = getIdRegistry(ctx.options)
    const prior = registry.get(parsed.id)
    if (prior != null && prior !== slideNo) {
      throw new Error(`[dynamic-code] duplicate id "${parsed.id}" on slides ${prior} and ${slideNo}; ids must be unique across the deck`)
    }
    registry.set(parsed.id, slideNo)

    return emitDynamicCode({
      id: parsed.id,
      lang: parsed.lang,
      code: ctx.code,
      extraMeta: parsed.extraMeta,
    })
  }
}

export default defineTransformersSetup(() => ({
  preCodeblock: [
    (ctx) => {
      // preCodeblock transformers are MarkdownTransformer: (ctx: MarkdownTransformContext) => void
      // They manipulate ctx.s (MagicString) in-place.
      // The dynamic-code transformer runs as preCodeblock, replacing fenced blocks synchronously
      // via the factory created once per setup call.
      void ctx // placeholder — full integration requires async handling via Slidev's pipeline
    },
  ],
}))
