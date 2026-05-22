import { defineRoutesSetup } from '@slidev/types'
import AdminPage from '../components/AdminPage.vue'

export default defineRoutesSetup((routes) => {
  return [
    ...routes,
    {
      name: 'dynamic-code-admin',
      path: '/dynamic-code-admin',
      component: AdminPage,
    },
  ]
})
