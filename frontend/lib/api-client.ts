import { initQueryClient } from '@ts-rest/react-query'
import { healthContract } from '@lowcor/contract'

export const tsrq = initQueryClient(healthContract, {
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
  baseHeaders: {
    get Authorization() {
      if (typeof window === 'undefined') return ''
      const token = localStorage.getItem('access_token')
      return token ? `Bearer ${token}` : ''
    },
    'Content-Type': 'application/json',
  },
})