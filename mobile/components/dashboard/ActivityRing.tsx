import React, { useEffect, useRef } from 'react'
import { Animated } from 'react-native'
import Svg, { Circle, G } from 'react-native-svg'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

export interface RingSpec {
  progress: number // 0..100
  color: string
  trackColor: string
  strokeWidth: number
}

interface ActivityRingProps {
  size: number
  rings: RingSpec[]
  /** Зазор между соседними кольцами. */
  gap?: number
}

// Концентрические кольца прогресса (внешнее → внутреннее), та же техника
// ручного SVG, что уже используется в Sparkline.tsx и mood.tsx — библиотек
// графиков в проекте нет. Анимация через strokeDashoffset обязана быть
// useNativeDriver:false — это свойство не входит в native-driver allowlist,
// но это разовая анимация при монтировании, не жестовая.
export function ActivityRing({ size, rings, gap = 3 }: ActivityRingProps) {
  const animValues = useRef(rings.map(() => new Animated.Value(0))).current
  const progressKey = rings.map((r) => r.progress).join(',')

  useEffect(() => {
    Animated.parallel(
      rings.map((ring, i) =>
        Animated.timing(animValues[i], {
          toValue: ring.progress,
          duration: 900,
          delay: i * 150,
          useNativeDriver: false,
        }),
      ),
    ).start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressKey])

  const center = size / 2
  let radiusCursor = center

  return (
    <Svg width={size} height={size}>
      <G rotation={-90} origin={`${center}, ${center}`}>
        {rings.map((ring, i) => {
          radiusCursor -= ring.strokeWidth / 2
          const radius = radiusCursor
          radiusCursor -= ring.strokeWidth / 2 + gap
          const circumference = 2 * Math.PI * radius
          const strokeDashoffset = animValues[i].interpolate({
            inputRange: [0, 100],
            outputRange: [circumference, 0],
          })

          return (
            <React.Fragment key={i}>
              <Circle
                cx={center}
                cy={center}
                r={radius}
                stroke={ring.trackColor}
                strokeWidth={ring.strokeWidth}
                fill="none"
              />
              <AnimatedCircle
                cx={center}
                cy={center}
                r={radius}
                stroke={ring.color}
                strokeWidth={ring.strokeWidth}
                fill="none"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </React.Fragment>
          )
        })}
      </G>
    </Svg>
  )
}
