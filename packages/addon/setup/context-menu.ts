import { defineContextMenuSetup } from '@slidev/types'
import { computed } from 'vue'

export default defineContextMenuSetup((items) => {
  return computed(() => {
    const list = [...items.value]
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
    if (!params.get('presenter'))
      return list

    list.push({
      small: false,
      icon: 'carbon:reset',
      label: 'Reset dynamic block',
      action: () => {
        const active = document.activeElement as HTMLElement | null
        const wrapper = active?.closest('.dynamic-code-wrapper') as HTMLElement | null
        wrapper?.dispatchEvent(new CustomEvent('dynamic-code:reset', { bubbles: true }))
      },
    })
    return list
  })
})
