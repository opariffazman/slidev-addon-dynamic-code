export interface Env {
  TALK_DO: DurableObjectNamespace
  PRESENTER_TOKEN: string
}

export { TalkDO } from './talk-do'

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)

    if (url.pathname !== '/pub' && url.pathname !== '/sub')
      return new Response('not found', { status: 404 })

    const talkId = url.searchParams.get('talk')
    if (!talkId)
      return new Response('missing talk', { status: 400 })

    if (url.pathname === '/pub') {
      if (url.searchParams.get('token') !== env.PRESENTER_TOKEN)
        return new Response('unauthorized', { status: 401 })
    }

    const id = env.TALK_DO.idFromName(talkId)
    return env.TALK_DO.get(id).fetch(req)
  },
} satisfies ExportedHandler<Env>
