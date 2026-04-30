'use client'

import { useEffect, useRef } from 'react'

interface Props {
  src: string
  alt: string
  className?: string
}

export default function WavingCircle({ src, alt, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = src

    let startTime = 0

    function draw(ts: number) {
      if (!startTime) startTime = ts
      const t = (ts - startTime) / 1000

      const W = canvas!.width
      const H = canvas!.height
      const cx = W / 2
      const cy = H / 2
      const R  = W / 2

      ctx!.clearRect(0, 0, W, H)

      ctx!.save()
      ctx!.beginPath()
      ctx!.arc(cx, cy, R - 1, 0, Math.PI * 2)
      ctx!.clip()

      if (img.complete && img.naturalWidth > 0) {
        const sliceW = 1
        const cols   = Math.ceil(W / sliceW)
        // Uniform amplitude across entire image — same wave everywhere
        const amp    = W * 0.008
        const freq   = 1.5
        const speed  = 0.3

        for (let col = 0; col < cols; col++) {
          const x  = col * sliceW
          const dy = amp * Math.sin((col / cols) * freq * Math.PI * 2 - t * speed * Math.PI * 2)

          ctx!.drawImage(
            img,
            (x / W) * img.naturalWidth, 0,
            (sliceW / W) * img.naturalWidth, img.naturalHeight,
            x, dy, sliceW, H
          )
        }
      }

      ctx!.restore()
      rafRef.current = requestAnimationFrame(draw)
    }

    function start() {
      rafRef.current = requestAnimationFrame(draw)
    }

    if (img.complete && img.naturalWidth > 0) {
      start()
    } else {
      img.onload = start
    }

    return () => { cancelAnimationFrame(rafRef.current) }
  }, [src])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        const dpr = window.devicePixelRatio || 1
        canvas.width  = Math.round(width  * dpr)
        canvas.height = Math.round(height * dpr)
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.scale(dpr, dpr)
      }
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-label={alt}
      role="img"
      className={className}
      style={{ width: '100%', height: '100%', display: 'block', borderRadius: '50%' }}
    />
  )
}
