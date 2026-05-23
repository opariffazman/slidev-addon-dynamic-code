import { mount } from '@vue/test-utils'
import lz from 'lz-string'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import DynamicCode from '../components/DynamicCode.vue'
import { syncKey } from '../components/sync-key'

// Hoisted mock state for the Slidev context helper. Tests mutate `slidevMock`
// before mounting; vi.mock returns a function that reads the current value.
const slidevMock = vi.hoisted(() => ({
  // Mutable reference the mock factory will read at call time.
  hook: null as null | (() => { $clicksContext?: any } | null),
}))

vi.mock('../composables/use-slidev-context', () => ({
  tryUseSlideContext: () => slidevMock.hook ? slidevMock.hook() : null,
}))

beforeEach(() => {
  // Default to "no Slidev context" — graceful-degrade path.
  slidevMock.hook = null
})

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

  it('reset event triggers broadcastReset and restores fenced content', async () => {
    const broadcastReset = vi.fn()
    const wrapper = mount(DynamicCode, {
      props: { id: 'install', lang: 'bash', originHash: 'h', codeLz },
      global: {
        provide: {
          [syncKey as symbol]: {
            mode: 'presenter',
            state: ref({ install: { hash: 'h', content: 'pnpm i' } }),
            status: ref('connected'),
            broadcastEdit: () => {},
            broadcastReset,
            broadcastResetAll: () => {},
          },
        },
      },
    })

    expect(wrapper.text()).toContain('pnpm i')
    await wrapper.find('.dynamic-code-wrapper').element.dispatchEvent(new CustomEvent('dynamic-code:reset', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(broadcastReset).toHaveBeenCalledWith('install')
  })
})

describe('<DynamicCode> ranges prop (graceful degrade)', () => {
  const code = 'npm install foo'
  const codeLz = lz.compressToBase64(code)

  it('renders with a ranges prop even when no Slidev context is available', () => {
    // slidevMock.hook is null from beforeEach → tryUseSlideContext returns null
    const wrapper = mount(DynamicCode, {
      props: {
        id: 'install',
        lang: 'bash',
        originHash: 'h',
        codeLz,
        ranges: ['2-3', '5', 'all'],
      },
      global: { provide: provideStub({ mode: 'presenter' }) },
    })
    // No context → no reveal pipeline → presenter textarea editable immediately
    expect(wrapper.find('textarea').attributes('readonly')).toBeUndefined()
  })
})

describe('<DynamicCode> ranges prop (click registration)', () => {
  const code = 'npm install foo'
  const codeLz = lz.compressToBase64(code)

  it('registers and unregisters click count when ranges + ctx are present', () => {
    const register = vi.fn()
    const unregister = vi.fn()
    const calculateSince = vi.fn().mockReturnValue({ start: 1, end: 3 })

    slidevMock.hook = () => ({
      $clicksContext: { current: 0, register, unregister, calculateSince },
    })

    const wrapper = mount(DynamicCode, {
      props: {
        id: 'install',
        lang: 'bash',
        originHash: 'h',
        codeLz,
        ranges: ['2-3', '5', 'all'],
      },
      global: { provide: provideStub({ mode: 'presenter' }) },
    })

    expect(calculateSince).toHaveBeenCalledWith('+1', 2)
    expect(register).toHaveBeenCalledTimes(1)
    const [regId, regInfo] = register.mock.calls[0]!
    expect(typeof regId).toBe('string')
    expect(regId).toMatch(/^dyn-/)
    expect(regInfo).toEqual({ start: 1, end: 3 })

    wrapper.unmount()
    expect(unregister).toHaveBeenCalledWith(regId)
  })

  it('does not register when ranges is absent', () => {
    const register = vi.fn()
    slidevMock.hook = () => ({
      $clicksContext: {
        current: 0,
        register,
        unregister: vi.fn(),
        calculateSince: () => ({ start: 1, end: 3 }),
      },
    })

    mount(DynamicCode, {
      props: { id: 'install', lang: 'bash', originHash: 'h', codeLz },
      global: { provide: provideStub({ mode: 'presenter' }) },
    })
    expect(register).not.toHaveBeenCalled()
  })

  it('does not register when context is missing (graceful degrade)', () => {
    // slidevMock.hook stays null from beforeEach
    const wrapper = mount(DynamicCode, {
      props: { id: 'install', lang: 'bash', originHash: 'h', codeLz, ranges: ['1', '2'] },
      global: { provide: provideStub({ mode: 'presenter' }) },
    })
    // Just assert no crash and textarea is editable (no reveal active).
    expect(wrapper.find('textarea').attributes('readonly')).toBeUndefined()
  })
})

describe('<DynamicCode> ranges prop (reveal state)', () => {
  const code = 'npm install foo'
  const codeLz = lz.compressToBase64(code)

  function mountWithClicks(cur: { value: number }, ranges: string[]) {
    slidevMock.hook = () => ({
      $clicksContext: {
        get current() { return cur.value },
        register: vi.fn(),
        unregister: vi.fn(),
        calculateSince: () => ({ start: 1, end: 1 + (ranges.length - 1) }),
      },
    })
    return mount(DynamicCode, {
      props: { id: 'install', lang: 'bash', originHash: 'h', codeLz, ranges },
      global: { provide: provideStub({ mode: 'presenter' }) },
    })
  }

  it('textarea is read-only at slide entry (revealIndex 0)', () => {
    const cur = ref(0)
    const wrapper = mountWithClicks(cur, ['2-3', '5', 'all'])
    // current=0 → revealIndex = max(0, 0 - 1 + 1) = 0; ranges.length-1 = 2; inReveal true
    expect(wrapper.find('textarea').attributes('readonly')).toBeDefined()
  })

  it('textarea unlocks once revealIndex reaches the final ranges item', async () => {
    const cur = ref(0)
    const wrapper = mountWithClicks(cur, ['2-3', '5', 'all'])
    cur.value = 2  // revealIndex = max(0, 2-1+1) = 2 = ranges.length-1 → inReveal false
    await wrapper.vm.$nextTick()
    expect(wrapper.find('textarea').attributes('readonly')).toBeUndefined()
  })

  it('unlocks immediately when ranges has a single item', () => {
    const cur = ref(0)
    const wrapper = mountWithClicks(cur, ['1'])
    // ranges.length=1 → end=1+0=1; revealIndex=0; ranges.length-1=0; inReveal = 0 < 0 → false
    expect(wrapper.find('textarea').attributes('readonly')).toBeUndefined()
  })
})
