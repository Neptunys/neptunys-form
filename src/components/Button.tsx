import type { CSSProperties, MouseEvent, PropsWithChildren } from 'react'
import type { ButtonTone } from '../lib/types'

type ButtonProps = PropsWithChildren<{
  tone?: ButtonTone
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  className?: string
  style?: CSSProperties
}>

export function Button({
  children,
  tone = 'secondary',
  onClick,
  type = 'button',
  disabled,
  className = '',
  style,
}: ButtonProps) {
  function handlePointerDown(event: MouseEvent<HTMLButtonElement>) {
    const element = event.currentTarget
    element.classList.remove('button-clicked')
    window.requestAnimationFrame(() => {
      element.classList.add('button-clicked')
      window.setTimeout(() => element.classList.remove('button-clicked'), 180)
    })
  }

  return (
    <button
      className={`button button-${tone} ${className}`.trim()}
      onClick={onClick}
      onMouseDown={handlePointerDown}
      type={type}
      disabled={disabled}
      style={{ ...style, opacity: disabled ? 0.5 : 1 }}
    >
      {children}
    </button>
  )
}
