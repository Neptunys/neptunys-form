import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { measureSharedControlWidth } from './utils'

type SharedControlWidthOptions = {
  fontFamily?: string
  fontSizePx?: number
  fontWeight?: number | string
  minWidth?: number
  horizontalPadding?: number
  extraWidth?: number
}

export function useSharedControlWidth(labels: string[], options?: SharedControlWidthOptions) {
  const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null)
  const [availableWidth, setAvailableWidth] = useState(0)

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    setContainerElement(node)
  }, [])

  useEffect(() => {
    if (!containerElement) {
      setAvailableWidth(0)
      return
    }

    const updateWidth = () => {
      const nextWidth = Math.max(0, Math.floor(containerElement.getBoundingClientRect().width))
      setAvailableWidth(nextWidth)
    }

    updateWidth()

    if (typeof ResizeObserver === 'undefined') {
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', updateWidth)
        return () => window.removeEventListener('resize', updateWidth)
      }
      return
    }

    const observer = new ResizeObserver(() => updateWidth())
    observer.observe(containerElement)

    return () => observer.disconnect()
  }, [containerElement])

  const labelsKey = labels.map((label) => label.trim()).join('\u001f')

  const desiredWidth = useMemo(() => {
    return measureSharedControlWidth(labels, {
      fontFamily: options?.fontFamily,
      fontSizePx: options?.fontSizePx,
      fontWeight: options?.fontWeight,
      minWidth: options?.minWidth,
      horizontalPadding: options?.horizontalPadding,
      extraWidth: options?.extraWidth,
    })
  }, [
    labelsKey,
    options?.fontFamily,
    options?.fontSizePx,
    options?.fontWeight,
    options?.minWidth,
    options?.horizontalPadding,
    options?.extraWidth,
  ])

  const finalWidth = availableWidth > 0 ? Math.min(desiredWidth, availableWidth) : desiredWidth

  const controlStyle = useMemo<CSSProperties>(() => ({
    width: `${Math.max(0, Math.round(finalWidth))}px`,
    maxWidth: '100%',
  }), [finalWidth])

  return {
    containerRef,
    controlStyle,
  }
}
