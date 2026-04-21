export function sendMessageToParent(eventName: string, payload?: Record<string, unknown>) {
  window.parent?.postMessage(
    {
      source: 'NEPTUNYSFORM',
      eventName,
      payload
    },
    '*'
  )
}
