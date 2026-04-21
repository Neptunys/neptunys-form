import { useCallback } from 'react'
import { createRoot } from 'react-dom/client'

import { AlertModalProps, Modal } from './Modal'

function createContainer() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return container
}

export function useAlert() {
  return useCallback((props: Omit<AlertModalProps, 'open' | 'onOpenChange'>) => {
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

    function onFinish() {
      props.onFinish?.()
      handleOpenChange(false)
    }

    root.render(
      <Modal.Alert open={true} {...props} onFinish={onFinish} onOpenChange={handleOpenChange} />
    )
  }, [])
}
