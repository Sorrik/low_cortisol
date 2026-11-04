// backend/src/nutrition/fatsecret.service.ts

import { Injectable, Logger } from '@nestjs/common'
import { ConfigService }      from '@nestjs/config'

export interface FoodItem {
  food_id: string
  name:    string
  brand?:  string
  per100g: {
    kcal:    number
    protein: number
    fat:     number
    carbs:   number
  }
}

@Injectable()
export class FatSecretService {
  private readonly logger = new Logger(FatSecretService.name)

  private readonly tokenUrl = 'https://oauth.fatsecret.com/connect/token'
  private readonly apiUrl   = 'https://platform.fatsecret.com/rest/server.api'

  private accessToken:    string | null = null
  private tokenExpiresAt: number        = 0

  constructor(private readonly config: ConfigService) {}

  // ── Public ────────────────────────────────────────────────

  async search(query: string, maxResults = 10): Promise<FoodItem[]> {
    const token = await this._getToken()

    const params = new URLSearchParams({
      method:            'foods.search',
      search_expression: query,
      format:            'json',
      max_results:       String(maxResults),
    })

    const res = await fetch(`${this.apiUrl}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      this.logger.error(`[search] FatSecret error: ${res.status}`)
      return []
    }
    const raw = await res.json()
    const foods = raw?.foods?.food

    if (!foods) return []

    const list = Array.isArray(foods) ? foods : [foods]
    return list.map(this._parseFood).filter(Boolean) as FoodItem[]
  }

  // ── Helpers ───────────────────────────────────────────────

  // Парсим строку вида:
  // "Per 100g - Calories: 165kcal | Fat: 3.57g | Carbs: 0g | Protein: 31g"
  private _parseFood(raw: any): FoodItem | null {
    try {
      const desc: string = raw.food_description ?? ''
      const kcal    = parseFloat(desc.match(/Calories:\s*([\d.]+)/i)?.[1] ?? '0')
      const fat     = parseFloat(desc.match(/Fat:\s*([\d.]+)/i)?.[1]      ?? '0')
      const carbs   = parseFloat(desc.match(/Carbs:\s*([\d.]+)/i)?.[1]    ?? '0')
      const protein = parseFloat(desc.match(/Protein:\s*([\d.]+)/i)?.[1]  ?? '0')

      return {
        food_id: raw.food_id,
        name:    raw.food_name,
        brand:   raw.brand_name ?? undefined,
        per100g: { kcal, protein, fat, carbs },
      }
    } catch {
      return null
    }
  }

  // OAuth 2.0 client_credentials — токен живёт 86400 сек
  private async _getToken(): Promise<string> {
    const now = Date.now()
    if (this.accessToken && now < this.tokenExpiresAt - 60_000) {
      return this.accessToken
    }

    const clientId     = this.config.get<string>('FATSECRET_CLIENT_ID')
    const clientSecret = this.config.get<string>('FATSECRET_CLIENT_SECRET')
    const credentials  = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const res = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        Authorization:  `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=basic',
    })

    if (!res.ok) throw new Error(`[FatSecret] Token error: ${res.status}`)

    const data          = await res.json()
    this.accessToken    = data.access_token
    this.tokenExpiresAt = now + data.expires_in * 1000

    this.logger.log('[_getToken] новый токен получен')
    return this.accessToken!
  }
}