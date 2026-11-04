// store/auth.store.ts
import { create } from 'zustand'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'

// Универсальный storage: SecureStore на устройстве, AsyncStorage в web
const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return AsyncStorage.getItem(key)
    return SecureStore.getItemAsync(key)
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') await AsyncStorage.setItem(key, value)
    else await SecureStore.setItemAsync(key, value)
  },
  async delete(key: string): Promise<void> {
    if (Platform.OS === 'web') await AsyncStorage.removeItem(key)
    else await SecureStore.deleteItemAsync(key)
  },
}

export interface AuthState {
  token:        string | null
  refreshToken: string | null
  userId:       string | null
  isReady:      boolean
  setAuth:      (token: string, refreshToken: string, userId: string) => Promise<void>
  setAccess:    (token: string) => void
  logout:       () => Promise<void>
  hydrate:      () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  token:        null,
  refreshToken: null,
  userId:       null,
  isReady:      false,

  setAuth: async (token: string, refreshToken: string, userId: string) => {
    await storage.set('token',         token)
    await storage.set('refresh_token', refreshToken)
    await storage.set('userId',        userId)
    set({ token, refreshToken, userId })
  },

  setAccess: (token: string) => {
    void storage.set('token', token)
    set({ token })
  },

  logout: async () => {
    await storage.delete('token')
    await storage.delete('refresh_token')
    await storage.delete('userId')
    set({ token: null, refreshToken: null, userId: null })
  },

  hydrate: async () => {
    const token        = await storage.get('token')
    const refreshToken = await storage.get('refresh_token')
    const userId       = await storage.get('userId')
    set({ token, refreshToken, userId, isReady: true })
  },
}))
