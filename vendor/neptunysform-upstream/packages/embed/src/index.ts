import { getConfigs } from './config'
import { isPlainObject, logger } from './utils'

import { AnyMap } from './type'

import { FullPage } from './full-page'
import { Modal } from './modal'
import { Popup } from './popup'
import { Standard } from './standard'
import './style.scss'

const loaded = new Set<string>()
const instances = new Map<string, Modal<any> | Popup<any>>()
const initializedMetaPixels = new Set<string>()
let messageBridgeInstalled = false

function getEventPayload(data: AnyMap): AnyMap {
  return isPlainObject(data.payload) ? (data.payload as AnyMap) : {}
}

function dispatchNeptunysformEvent(eventName: string, payload: AnyMap) {
  window.dispatchEvent(
    new CustomEvent('neptunysform:event', {
      detail: {
        eventName,
        payload
      }
    })
  )
}

function bridgeMetaPixel(eventName: string, payload: AnyMap) {
  if (!payload.metaPixelEnabled) {
    return
  }

  const win = window as Window & {
    fbq?: (...args: any[]) => void
  }

  if (typeof win.fbq !== 'function') {
    return
  }

  if (typeof payload.metaPixelId === 'string' && payload.metaPixelId.trim()) {
    const metaPixelId = payload.metaPixelId.trim()

    if (!initializedMetaPixels.has(metaPixelId)) {
      win.fbq('set', 'autoConfig', false, metaPixelId)
      win.fbq('init', metaPixelId)
      initializedMetaPixels.add(metaPixelId)
    }
  }

  switch (eventName) {
    case 'FORM_OPENED':
      win.fbq('trackCustom', 'Quizview', payload)
      break

    case 'FORM_SUBMITTED':
      win.fbq('track', 'Lead', payload)
      break
  }
}

function installMessageBridge() {
  if (messageBridgeInstalled) {
    return
  }

  messageBridgeInstalled = true
  window.addEventListener('message', ({ data }: MessageEvent) => {
    if (!isPlainObject(data) || data.source !== 'NEPTUNYSFORM' || typeof data.eventName !== 'string') {
      return
    }

    const payload = getEventPayload(data)

    dispatchNeptunysformEvent(data.eventName, payload)
    bridgeMetaPixel(data.eventName, payload)
  })
}

function main() {
  try {
    const configs = getConfigs()

    configs.forEach(c => {
      const key = `${c.formId}-${c.type}`

      if (!loaded.has(key)) {
        loaded.add(key)

        switch (c.type) {
          case 'modal':
            return instances.set(key, new Modal(c))

          case 'popup':
            return instances.set(key, new Popup(c))

          case 'fullpage':
            return new FullPage(c)

          default:
            return new Standard(c)
        }
      }
    })

    logger.info('Configs', JSON.stringify(configs))
  } catch (err) {
    logger.error(err)
  }
}

function open(formId: string, type: 'modal' | 'popup') {
  const instance = instances.get(`${formId}-${type}`)

  if (instance) {
    instance.open()
  }
}

function close(formId: string, type: 'modal' | 'popup') {
  const instance = instances.get(`${formId}-${type}`)

  if (instance) {
    instance.close()
  }
}

function toggle(formId: string, type: 'modal' | 'popup') {
  const instance = instances.get(`${formId}-${type}`)

  if (instance) {
    instance.toggle()
  }
}

export const openModal = (formId: string) => open(formId, 'modal')
export const closeModal = (formId: string) => close(formId, 'modal')
export const toggleModal = (formId: string) => toggle(formId, 'modal')
export const openPopup = (formId: string) => open(formId, 'popup')
export const closePopup = (formId: string) => close(formId, 'popup')
export const togglePopup = (formId: string) => toggle(formId, 'popup')

// Import the library after the element
main()
installMessageBridge()

// Import the library before the element
window.addEventListener('DOMContentLoaded', () => {
  installMessageBridge()
  main()
})
