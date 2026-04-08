import type { MouseEvent, PropsWithChildren } from 'react'
import type { ButtonTone } from '../lib/types'

type ButtonProps = PropsWithChildren<{
  tone?: ButtonTone
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  className?: string
}>

export function Button({
  children,
  tone = 'secondary',
  onClick,
  type = 'button',
  disabled,
  className = '',
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
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      {children}
    </button>
  )
}
