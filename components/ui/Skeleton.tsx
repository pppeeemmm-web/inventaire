import React from 'react'

export function Skeleton({
  w,
  h,
  style,
  className = '',
  radius = 4,
}: {
  w?: number | string
  h?: number | string
  radius?: number
  style?: React.CSSProperties
  className?: string
}) {
  return (
    <div
      className={`pem-skeleton pulse ${className}`}
      style={{
        width: w,
        height: h,
        borderRadius: radius,
        ...style,
      }}
      aria-hidden
    />
  )
}

