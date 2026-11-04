// Затемняет hex-цвет на |percent|% (0..100). Используется для построения
// второй точки градиента карточек метрик из уже существующих тем-токенов
// (colors.sleep, colors.activity, ...), без отдельной цветовой библиотеки.
export function shadeHex(hex: string, percent: number): string {
  const clean = hex.replace('#', '')
  const num = parseInt(clean, 16)
  const r = (num >> 16) & 0xff
  const g = (num >> 8) & 0xff
  const b = num & 0xff

  const factor = 1 + percent / 100
  const shade = (channel: number) => Math.max(0, Math.min(255, Math.round(channel * factor)))

  const toHex = (channel: number) => channel.toString(16).padStart(2, '0')

  return `#${toHex(shade(r))}${toHex(shade(g))}${toHex(shade(b))}`
}

// Два стопа градиента для фона карточки метрики, построенные из одного
// уже подобранного тем-токена (colors.sleep и т.п.) — работает системно
// для обеих тем сразу.
export function gradientColors(color: string): [string, string] {
  return [color, shadeHex(color, -18)]
}
