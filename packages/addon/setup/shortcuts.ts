import { defineShortcutsSetup } from '@slidev/types'

export default defineShortcutsSetup((_nav, defaults) => {
  return [
    ...defaults,
    {
      key: 'meta+shift+r',
      name: 'Reset focused dynamic block',
      fn: () => {
        const active = document.activeElement as HTMLElement | null
        if (!active || !active.closest('.dynamic-code-wrapper'))
          return
        const wrapper = active.closest('.dynamic-code-wrapper') as HTMLElement
        wrapper.dispatchEvent(new CustomEvent('dynamic-code:reset', { bubbles: true }))
      },
    },
    {
      key: 'ctrl+shift+r',
      name: 'Reset focused dynamic block',
      fn: () => {
        const active = document.activeElement as HTMLElement | null
        if (!active || !active.closest('.dynamic-code-wrapper'))
          return
        const wrapper = active.closest('.dynamic-code-wrapper') as HTMLElement
        wrapper.dispatchEvent(new CustomEvent('dynamic-code:reset', { bubbles: true }))
      },
    },
  ]
})
