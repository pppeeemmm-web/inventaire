'use client'

// WavingCircle — draws a circular image on a canvas with a gentle flag-wave
// distortion. The wave propagates left→right, like a flag in a soft breeze.

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

    // Load image
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = src

    let startTime = 0

    function draw(ts: number) {
      if (!startTime) startTime = ts
      const t = (ts - startTime) / 1000 // seconds

      const W = canvas!.width
      const H = canvas!.height
      const cx = W / 2
      const cy = H / 2
      const R  = W / 2

      ctx!.clearRect(0, 0, W, H)

      // Wave parameters — subtle flag-in-breeze feel
      const waveAmp   = W * 0.022   // amplitude: ~2% of width
      const waveFreq  = 2.2         // spatial frequency (cycles across image)
      const waveSpeed = 0.55        // how fast the wave travels (cycles/sec)
      const wavePhase = t * waveSpeed * Math.PI * 2

      // Draw column by column with vertical sine displacement
      const sliceW = 1 // 1px column for smooth result
      const cols   = Math.ceil(W / sliceW)

      // Clip to circle
      ctx!.save()
      ctx!.beginPath()
      ctx!.arc(cx, cy, R - 1, 0, Math.PI * 2)
      ctx!.clip()

      if (img.complete && img.naturalWidth > 0) {
        for (let col = 0; col < cols; col++) {
          const x    = col * sliceW
          // progress 0→1 from left to right
          const prog = col / cols
          // flag wave: amplitude increases toward right edge (fixed left)
          const amp  = waveAmp * prog * prog
          const dy   = amp * Math.sin(prog * waveFreq * Math.PI * 2 - wavePhase)

          ctx!.drawImage(
            img,
            // source: 1px column from the original image
            (x / W) * img.naturalWidth, 0, (sliceW / W) * img.naturalWidth, img.naturalHeight,
            // dest: shifted vertically by dy
            x, dy, sliceW, H
          )
        }
      }

      ctx!.restore()

      // Soft circular vignette
      const grad = ctx!.createRadialGradient(cx, cy, R * 0.55, cx, cy, R)
      grad.addColorStop(0, 'rgba(237,234,228,0)')
      grad.addColorStop(1, 'rgba(237,234,228,0.18)')
      ctx!.save()
      ctx!.beginPath()
      ctx!.arc(cx, cy, R, 0, Math.PI * 2)
      ctx!.fillStyle = grad
      ctx!.fill()
      ctx!.restore()

      rafRef.current = requestAnimationFrame(draw)
    }

    // Start once image loads (or immediately if cached)
    function start() {
      rafRef.current = requestAnimationFrame(draw)
    }

    if (img.complete && img.naturalWidth > 0) {
      start()
    } else {
      img.onload = start
    }

    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [src])

  // Size canvas to match CSS size via ResizeObserver
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
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        borderRadius: '50%',
        // subtle drop shadow
        filter: 'drop-shadow(0 12px 40px rgba(0,0,0,0.10))',
      }}
    />
  )
}
