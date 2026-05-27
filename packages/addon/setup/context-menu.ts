import { defineContextMenuSetup } from '@slidev/types'
import { computed } from 'vue'

export default defineContextMenuSetup((items) => {
  return computed(() => [...items.value])
})
