import { useCallback } from 'react'
import { createRoot } from 'react-dom/client'

import { Modal, PromptModalProps } from './Modal'

function createContainer() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return container
}

export function usePrompt() {
  return useCallback((props: Omit<PromptModalProps, 'open' | 'onOpenChange'>) => {
    const dialogContainer = createContainer()
    const root = createRoot(dialogContainer)
    let disposed = false

    function dispose() {
      if (disposed) {
        return
      }

      disposed = true
      root.unmount()

      if (dialogContainer.parentNode === document.body) {
        document.body.removeChild(dialogContainer)
      }
    }

    function handleOpenChange(open: boolean) {
      if (!open) {
        dispose()
      }
    }

    function onChange(values: any) {
      props.onChange?.(values)
      handleOpenChange(false)
    }

    root.render(
      <Modal.Prompt open={true} {...props} onChange={onChange} onOpenChange={handleOpenChange} />
    )
  }, [])
}
