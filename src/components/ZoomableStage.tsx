import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useGesture } from '@use-gesture/react'
import type { Vec2 } from '../core/types'

interface Transform {
  x: number
  y: number
  scale: number
}

interface ZoomableStageProps {
  imageUrl: string
  imageWidth: number
  imageHeight: number
  /** Tap in image-pixel coordinates. */
  onTap?: (p: Vec2) => void
  /** While a finger/pointer is down: image coords + screen coords (for the loupe). Null on release. */
  onPress?: (p: { image: Vec2; screen: Vec2 } | null) => void
  /** Reports the current stage scale (for constant-screen-size markers). */
  onScaleChange?: (scale: number) => void
  /** Markers rendered in image-pixel space (inside the transformed content). */
  children?: ReactNode
}

const MAX_SCALE_FACTOR = 8

export function ZoomableStage({
  imageUrl,
  imageWidth,
  imageHeight,
  onTap,
  onPress,
  onScaleChange,
  children,
}: ZoomableStageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 })
  const [fitScale, setFitScale] = useState(1)
  const transformRef = useRef(transform)
  transformRef.current = transform

  useEffect(() => {
    onScaleChange?.(transform.scale)
  }, [transform.scale, onScaleChange])

  // Fit the image into the container on mount / image change.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const fit = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const scale = Math.min(rect.width / imageWidth, rect.height / imageHeight)
      setFitScale(scale)
      setTransform({
        scale,
        x: (rect.width - imageWidth * scale) / 2,
        y: (rect.height - imageHeight * scale) / 2,
      })
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    return () => observer.disconnect()
  }, [imageUrl, imageWidth, imageHeight])

  const clampTransform = (t: Transform): Transform => {
    const el = containerRef.current
    if (!el) return t
    const rect = el.getBoundingClientRect()
    const w = imageWidth * t.scale
    const h = imageHeight * t.scale
    // Keep at least a third of the image inside the viewport on each axis.
    const minX = Math.min(rect.width - w, rect.width / 3 - w)
    const maxX = Math.max(0, (rect.width * 2) / 3)
    const minY = Math.min(rect.height - h, rect.height / 3 - h)
    const maxY = Math.max(0, (rect.height * 2) / 3)
    return {
      scale: t.scale,
      x: Math.min(maxX, Math.max(minX, t.x)),
      y: Math.min(maxY, Math.max(minY, t.y)),
    }
  }

  const screenToImage = (clientX: number, clientY: number): Vec2 => {
    const rect = containerRef.current!.getBoundingClientRect()
    const t = transformRef.current
    return {
      x: (clientX - rect.left - t.x) / t.scale,
      y: (clientY - rect.top - t.y) / t.scale,
    }
  }

  const inImage = (p: Vec2) => p.x >= 0 && p.y >= 0 && p.x <= imageWidth && p.y <= imageHeight

  useGesture(
    {
      onDrag: ({ active, movement, memo, tap, event, last, touches }) => {
        if (tap) {
          const e = event as PointerEvent
          const p = screenToImage(e.clientX, e.clientY)
          if (inImage(p)) onTap?.(p)
          onPress?.(null)
          return
        }
        if (touches > 1) {
          onPress?.(null)
          return memo
        }
        const start: Transform = memo ?? transformRef.current
        if (active) {
          const e = event as PointerEvent
          if (e.clientX !== undefined) {
            const rect = containerRef.current!.getBoundingClientRect()
            onPress?.({
              image: screenToImage(e.clientX, e.clientY),
              screen: { x: e.clientX - rect.left, y: e.clientY - rect.top },
            })
          }
          setTransform(
            clampTransform({ ...start, x: start.x + movement[0], y: start.y + movement[1] }),
          )
        }
        if (last) onPress?.(null)
        return start
      },
      onPinch: ({ origin, offset: [scale], memo }) => {
        onPress?.(null)
        const rect = containerRef.current!.getBoundingClientRect()
        const start: { t: Transform; p: Vec2 } = memo ?? {
          t: transformRef.current,
          p: screenToImage(origin[0], origin[1]),
        }
        // Keep the pinch origin's image point fixed under the fingers.
        const next: Transform = {
          scale,
          x: origin[0] - rect.left - start.p.x * scale,
          y: origin[1] - rect.top - start.p.y * scale,
        }
        setTransform(clampTransform(next))
        return start
      },
      onDoubleClick: ({ event }) => {
        const e = event as MouseEvent
        const t = transformRef.current
        const zoomedIn = t.scale > fitScale * 1.5
        const targetScale = zoomedIn ? fitScale : fitScale * 3
        const p = screenToImage(e.clientX, e.clientY)
        const rect = containerRef.current!.getBoundingClientRect()
        if (zoomedIn) {
          setTransform({
            scale: fitScale,
            x: (rect.width - imageWidth * fitScale) / 2,
            y: (rect.height - imageHeight * fitScale) / 2,
          })
        } else {
          setTransform(
            clampTransform({
              scale: targetScale,
              x: rect.width / 2 - p.x * targetScale,
              y: rect.height / 2 - p.y * targetScale,
            }),
          )
        }
      },
      onWheel: ({ event, delta: [, dy] }) => {
        event.preventDefault()
        const t = transformRef.current
        const factor = dy > 0 ? 0.9 : 1.1
        const scale = Math.min(
          fitScale * MAX_SCALE_FACTOR,
          Math.max(fitScale * 0.5, t.scale * factor),
        )
        const e = event as WheelEvent
        const rect = containerRef.current!.getBoundingClientRect()
        const p = screenToImage(e.clientX, e.clientY)
        setTransform(
          clampTransform({
            scale,
            x: e.clientX - rect.left - p.x * scale,
            y: e.clientY - rect.top - p.y * scale,
          }),
        )
      },
    },
    {
      target: containerRef,
      drag: { filterTaps: true, tapsThreshold: 10, pointer: { touch: true } },
      pinch: {
        scaleBounds: () => ({ min: fitScale * 0.5, max: fitScale * MAX_SCALE_FACTOR }),
        rubberband: true,
        from: () => [transformRef.current.scale, 0],
      },
      wheel: { eventOptions: { passive: false } },
    },
  )

  return (
    <div ref={containerRef} className="stage">
      <div
        className="stage-content"
        style={{
          width: imageWidth,
          height: imageHeight,
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
        }}
      >
        <img src={imageUrl} width={imageWidth} height={imageHeight} alt="" draggable={false} />
        {children}
      </div>
    </div>
  )
}
