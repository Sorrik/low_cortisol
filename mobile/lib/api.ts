// lib/api.ts
import axios, { AxiosError } from 'axios'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem('token')
  return SecureStore.getItemAsync('token')
}

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(async (config) => {
  const token = await getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    console.error(
      '[API Error]',
      error.config?.method?.toUpperCase(),
      error.config?.url,
      error.response?.status,
      error.response?.data,
    )
    return Promise.reject(error)
  }
)