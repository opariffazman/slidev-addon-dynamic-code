import { mount } from '@vue/test-utils'
import lz from 'lz-string'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import DynamicCode from '../components/DynamicCode.vue'
import { syncKey } from '../components/sync-key'

function provideStub(overrides: Partial<{
  mode: 'presenter' | 'audience'
  state: Record<string, { hash: string, content: string }>
  status: string
}> = {}) {
  return {
    [syncKey as symbol]: {
      mode: overrides.mode ?? 'audience',
      state: ref(overrides.state ?? {}),
      status: ref(overrides.status ?? 'connected'),
      broadcastEdit: () => {},
      broadcastReset: () => {},
      broadcastResetAll: () => {},
    },
  }
}

describe('<DynamicCode>', () => {
  const code = 'npm install foo'
  const codeLz = lz.compressToBase64(code)

  it('renders fenced content when no incoming update', () => {
    const wrapper = mount(DynamicCode, {
      props: { id: 'install', lang: 'bash', originHash: 'aaaaaaaaaaaa', codeLz },
      global: { provide: provideStub() },
    })
    expect(wrapper.text()).toContain('npm install foo')
  })

  it('shows incoming WS content over fenced when hash matches', async () => {
    const state = { install: { hash: 'aaaaaaaaaaaa', content: 'yarn add foo' } }
    const wrapper = mount(DynamicCode, {
      props: { id: 'install', lang: 'bash', originHash: 'aaaaaaaaaaaa', codeLz },
      global: { provide: provideStub({ state }) },
    })
    expect(wrapper.text()).toContain('yarn add foo')
    expect(wrapper.text()).not.toContain('npm install foo')
  })

  it('ignores incoming WS content when hash mismatches', async () => {
    const state = { install: { hash: 'differenthash', content: 'pnpm install foo' } }
    const wrapper = mount(DynamicCode, {
      props: { id: 'install', lang: 'bash', originHash: 'aaaaaaaaaaaa', codeLz },
      global: { provide: provideStub({ state }) },
    })
    expect(wrapper.text()).toContain('npm install foo')
    expect(wrapper.text()).not.toContain('pnpm install foo')
  })

  it('textarea is readonly in audience mode', () => {
    const wrapper = mount(DynamicCode, {
      props: { id: 'install', lang: 'bash', originHash: 'aaaaaaaaaaaa', codeLz },
      global: { provide: provideStub({ mode: 'audience' }) },
    })
    expect(wrapper.find('textarea').attributes('readonly')).toBeDefined()
  })

  it('textarea is editable in presenter mode', () => {
    const wrapper = mount(DynamicCode, {
      props: { id: 'install', lang: 'bash', originHash: 'aaaaaaaaaaaa', codeLz },
      global: { provide: provideStub({ mode: 'presenter' }) },
    })
    expect(wrapper.find('textarea').attributes('readonly')).toBeUndefined()
  })

  it('broadcasts an edit after debounce when presenter types', async () => {
    vi.useFakeTimers()
    try {
      const broadcastEdit = vi.fn()
      const wrapper = mount(DynamicCode, {
        props: { id: 'install', lang: 'bash', originHash: 'aaaaaaaaaaaa', codeLz },
        global: {
          provide: {
            [syncKey as symbol]: {
              mode: 'presenter',
              state: ref({}),
              status: ref('connected'),
              broadcastEdit,
              broadcastReset: () => {},
              broadcastResetAll: () => {},
            },
          },
        },
      })
      const textarea = wrapper.find('textarea')
      await textarea.setValue('pnpm install foo')
      vi.advanceTimersByTime(199)
      expect(broadcastEdit).not.toHaveBeenCalled()
      vi.advanceTimersByTime(2)
      expect(broadcastEdit).toHaveBeenCalledWith('install', 'aaaaaaaaaaaa', 'pnpm install foo')
    }
    finally {
      vi.useRealTimers()
    }
  })
})
