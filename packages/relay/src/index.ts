export interface Env {
  TALK_DO: DurableObjectNamespace
  PRESENTER_TOKEN: string
}

export { TalkDO } from './talk-do'

export default {
  async fetch(_req: Request, _env: Env): Promise<Response> {
    return new Response('relay alive', { status: 200 })
  },
} satisfies ExportedHandler<Env>
