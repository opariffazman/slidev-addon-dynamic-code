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

  it('copy button copies current display content (audience mode)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    })
    // Stub execCommand for legacy clipboard fallback in happy-dom
    const execCommandMock = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', {
      value: execCommandMock,
      writable: true,
      configurable: true,
    })

    const state = { install: { hash: 'aaaaaaaaaaaa', content: 'yarn add foo' } }
    const wrapper = mount(DynamicCode, {
      props: { id: 'install', lang: 'bash', originHash: 'aaaaaaaaaaaa', codeLz },
      global: { provide: provideStub({ mode: 'audience', state }) },
    })

    await wrapper.find('button.dynamic-code-copy').trigger('click')
    // Either clipboard API or legacy execCommand was invoked
    const clipboardUsed = writeText.mock.calls.some(args => args[0] === 'yarn add foo')
    const legacyUsed = execCommandMock.mock.calls.length > 0
    expect(clipboardUsed || legacyUsed).toBe(true)
  })

  it('copy button is rendered in both modes', () => {
    const audience = mount(DynamicCode, {
      props: { id: 'a', lang: 'bash', originHash: 'h', codeLz },
      global: { provide: provideStub({ mode: 'audience' }) },
    })
    const presenter = mount(DynamicCode, {
      props: { id: 'a', lang: 'bash', originHash: 'h', codeLz },
      global: { provide: provideStub({ mode: 'presenter' }) },
    })
    expect(audience.find('button.dynamic-code-copy').exists()).toBe(true)
    expect(presenter.find('button.dynamic-code-copy').exists()).toBe(true)
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

  it('shows connection badge in presenter mode', () => {
    const wrapper = mount(DynamicCode, {
      props: { id: 'a', lang: 'bash', originHash: 'h', codeLz },
      global: { provide: provideStub({ mode: 'presenter', status: 'connected' }) },
    })
    const badge = wrapper.find('.dynamic-code-badge')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('●')
  })

  it('hides connection badge in audience mode', () => {
    const wrapper = mount(DynamicCode, {
      props: { id: 'a', lang: 'bash', originHash: 'h', codeLz },
      global: { provide: provideStub({ mode: 'audience', status: 'connected' }) },
    })
    expect(wrapper.find('.dynamic-code-badge').exists()).toBe(false)
  })

  it('badge changes glyph by status', () => {
    for (const [status, glyph] of [
      ['connected', '●'],
      ['reconnecting', '◐'],
      ['offline', '○'],
      ['rejected', '⚠'],
    ] as const) {
      const wrapper = mount(DynamicCode, {
        props: { id: 'a', lang: 'bash', originHash: 'h', codeLz },
        global: { provide: provideStub({ mode: 'presenter', status }) },
      })
      expect(wrapper.find('.dynamic-code-badge').text()).toBe(glyph)
    }
  })
})
