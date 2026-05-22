import { DurableObject } from 'cloudflare:workers'

export class TalkDO extends DurableObject {
  async fetch(_req: Request): Promise<Response> {
    return new Response('not implemented', { status: 501 })
  }
}
