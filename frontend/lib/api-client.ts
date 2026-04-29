import { initQueryClient } from '@ts-rest/react-query'
import { healthContract } from '@lowcor/contract'
import { getAccessToken } from './auth-store'

export const tsrq = initQueryClient(healthContract, {
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
  baseHeaders: {
    get Authorization() {
      const token = getAccessToken()
      return token ? `Bearer ${token}` : ''
    },
    'Content-Type': 'application/json',
  },
})