import {
  FormRenderer,
  getTheme,
  getThemeStyle,
  getWebFontURL,
  sendMessageToParent
} from '@heyform-inc/form-renderer/src'
import {
  CaptchaKindEnum,
  FieldKindEnum,
  FormModel,
  HiddenFieldAnswer
} from '@heyform-inc/shared-types-enums'
import { FC, useEffect, useRef, useState } from 'react'

import { EndpointService } from '../service/endpoint'
import { recaptchaToken } from '../utils/captcha'
import { isStripeEnabled } from '../utils/payment'
import { Uploader } from '../utils/uploader'
import { helper } from '@heyform-inc/utils'

import { GOOGLE_RECAPTCHA_KEY } from '@/consts/env'

import { PasswordCheck } from './PasswordCheck'

interface RendererProps {
  form: FormModel & { integrations?: Record<string, string> }
  query: Record<string, Any>
  locale: string
  contactId?: string
  experimentId?: string
}

let captchaRef: Any = null

function getTrackingRegistry() {
  const win = window as Any

  if (!win.__HEYFORM_TRACKING__) {
    win.__HEYFORM_TRACKING__ = {
      ga4: new Set<string>(),
      gtm: new Set<string>(),
      meta: new Set<string>()
    }
  }

  return win.__HEYFORM_TRACKING__ as {
    ga4: Set<string>
    gtm: Set<string>
    meta: Set<string>
  }
}

function ensureGa4(measurementId?: string) {
  if (!measurementId) {
    return
  }

  const win = window as Any
  const registry = getTrackingRegistry()

  win.dataLayer = win.dataLayer || []
  win.gtag =
    win.gtag ||
    function () {
      win.dataLayer.push(arguments)
    }

  if (!document.getElementById('heyform-ga4-sdk')) {
    const script = document.createElement('script')
    script.id = 'heyform-ga4-sdk'
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
    document.head.appendChild(script)
    win.gtag('js', new Date())
  }

  if (!registry.ga4.has(measurementId)) {
    win.gtag('config', measurementId)
    registry.ga4.add(measurementId)
  }
}

function ensureGtm(containerId?: string) {
  if (!containerId) {
    return
  }

  const registry = getTrackingRegistry()
  const win = window as Any
  win.dataLayer = win.dataLayer || []

  if (registry.gtm.has(containerId)) {
    return
  }

  win.dataLayer.push({
    'gtm.start': Date.now(),
    event: 'gtm.js'
  })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${containerId}`
  document.head.appendChild(script)
  registry.gtm.add(containerId)
}

function ensureMetaPixel(pixelId?: string) {
  if (!pixelId) {
    return
  }

  const registry = getTrackingRegistry()
  const win = window as Any

  if (!win.fbq) {
    const fbq = function (...args: Any[]) {
      ;(fbq as Any).callMethod ? (fbq as Any).callMethod.apply(fbq, args) : (fbq as Any).queue.push(args)
    }

    ;(fbq as Any).queue = []
    ;(fbq as Any).loaded = true
    ;(fbq as Any).version = '2.0'
    win.fbq = fbq

    const script = document.createElement('script')
    script.async = true
    script.src = 'https://connect.facebook.net/en_US/fbevents.js'
    document.head.appendChild(script)
  }

  if (!registry.meta.has(pixelId)) {
    win.fbq('init', pixelId)
    registry.meta.add(pixelId)
  }
}

function trackPublicEvent(
  form: FormModel & { integrations?: Record<string, string> },
  eventName: 'heyform_view' | 'heyform_submit'
) {
  const win = window as Any
  const payload = {
    formId: form.id,
    formName: form.name
  }

  if (form.integrations?.googleanalytics4 && typeof win.gtag === 'function') {
    win.gtag('event', eventName, payload)
  }

  if (form.integrations?.googletagmanager && Array.isArray(win.dataLayer)) {
    win.dataLayer.push({
      event: eventName,
      ...payload
    })
  }

  if (form.integrations?.metapixel && typeof win.fbq === 'function') {
    win.fbq('track', eventName === 'heyform_submit' ? 'Lead' : 'PageView')
    win.fbq('trackCustom', eventName, payload)
  }
}

export const Renderer: FC<RendererProps> = ({ form, query, locale, contactId, experimentId }) => {
  const openTokenRef = useRef<string>('')
  const passwordTokenRef = useRef<string>('')
  const lastKeepaliveSyncAtRef = useRef<number>(0)
  const activeQuestionRef = useRef<
    | {
        questionId: string
        order: number
        title?: string
      }
    | undefined
  >(undefined)
  const activeQuestionStartedAtRef = useRef<number>(0)
  const questionMetricsRef = useRef<
    Record<
      string,
      {
        questionId: string
        order: number
        title?: string
        views: number
        totalDurationMs: number
        completed: boolean
      }
    >
  >({})
  const [isPasswordChecked, setIsPasswordChecked] = useState(false)

  function getSessionMetrics() {
    return Object.values(questionMetricsRef.current).sort((left, right) => left.order - right.order)
  }

  function flushActiveQuestion(markCompleted = true) {
    const activeQuestion = activeQuestionRef.current

    if (!activeQuestion || !activeQuestionStartedAtRef.current) {
      return
    }

    const metric = questionMetricsRef.current[activeQuestion.questionId]

    if (!metric) {
      return
    }

    metric.totalDurationMs += Math.max(0, Date.now() - activeQuestionStartedAtRef.current)

    if (markCompleted) {
      metric.completed = true
    }

    activeQuestionStartedAtRef.current = 0
  }

  async function syncSession(keepalive = false) {
    if (!openTokenRef.current) {
      return false
    }

    return EndpointService.updateFormSession({
      formId: form.id,
      openToken: openTokenRef.current,
      metrics: getSessionMetrics(),
      lastQuestionId: activeQuestionRef.current?.questionId,
      lastQuestionOrder: activeQuestionRef.current?.order
    }, { keepalive })
  }

  function syncSessionOnBackground() {
    const now = Date.now()

    if (now - lastKeepaliveSyncAtRef.current < 750) {
      return
    }

    lastKeepaliveSyncAtRef.current = now
    flushActiveQuestion(false)
    void syncSession(true).catch(() => undefined)
  }

  function handleQuestionChange(
    question?: {
      questionId: string
      order: number
      title?: string
    }
  ) {
    if (activeQuestionRef.current?.questionId === question?.questionId) {
      return
    }

    flushActiveQuestion(true)
    activeQuestionRef.current = question

    if (!question) {
      void syncSession().catch(console.error)
      return
    }

    const metric = questionMetricsRef.current[question.questionId] || {
      questionId: question.questionId,
      order: question.order,
      title: question.title,
      views: 0,
      totalDurationMs: 0,
      completed: false
    }

    metric.order = question.order
    metric.title = question.title
    metric.views += 1
    questionMetricsRef.current[question.questionId] = metric
    activeQuestionStartedAtRef.current = Date.now()

    void syncSession().catch(console.error)
  }

  function loadExternalScript(id: string, src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const loadedScript = document.getElementById(id) as HTMLScriptElement | null

      if (loadedScript) {
        if (loadedScript.dataset.loaded === 'true') {
          resolve()
          return
        }

        loadedScript.addEventListener('load', () => resolve(), { once: true })
        loadedScript.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), {
          once: true
        })
        return
      }

      const script = document.createElement('script')
      script.id = id
      script.src = src
      script.async = true
      script.defer = true
      script.addEventListener(
        'load',
        () => {
          script.dataset.loaded = 'true'
          resolve()
        },
        { once: true }
      )
      script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), {
        once: true
      })
      document.body.appendChild(script)
    })
  }

  async function ensureCaptchaReady() {
    if (form.settings?.captchaKind !== CaptchaKindEnum.GOOGLE_RECAPTCHA) {
      return
    }

    if (
      captchaRef?.ready &&
      (typeof captchaRef?.execute === 'function' ||
        typeof captchaRef?.enterprise?.execute === 'function')
    ) {
      return
    }

    const key =
      window.heyform?.googleRecaptchaKey ||
      (form.settings as Any)?.googleRecaptchaKey ||
      GOOGLE_RECAPTCHA_KEY

    if (!key) {
      throw new Error('Google reCAPTCHA key is not configured')
    }

    window.heyform = window.heyform || {}
    window.heyform.googleRecaptchaKey = key

    await loadExternalScript(
      'google-recaptcha-sdk',
      `https://www.google.com/recaptcha/api.js?render=${key}`
    )
    captchaRef = window.grecaptcha

    // Some keys only work with enterprise.js. Fallback automatically.
    if (
      !captchaRef?.ready ||
      (typeof captchaRef?.execute !== 'function' &&
        typeof captchaRef?.enterprise?.execute !== 'function')
    ) {
      await loadExternalScript(
        'google-recaptcha-enterprise-sdk',
        `https://www.google.com/recaptcha/enterprise.js?render=${key}`
      )
      captchaRef = window.grecaptcha
    }

    if (!captchaRef?.ready) {
      throw new Error('Google reCAPTCHA failed to initialize')
    }
  }

  async function openForm() {
    sendMessageToParent('FORM_OPENED')
    const input = {
      formId: form.id,
      experimentId,
      variantFormId: form.id,
      landingUrl: window.location.href,
      referrer: document.referrer,
      utmSource: query.utm_source,
      utmMedium: query.utm_medium,
      utmCampaign: query.utm_campaign,
      utmTerm: query.utm_term,
      utmContent: query.utm_content
    }

    let lastError: unknown

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        openTokenRef.current = await EndpointService.openForm(input)
        trackPublicEvent(form, 'heyform_view')
        await syncSession().catch(console.error)
        return
      } catch (error) {
        lastError = error
      }
    }

    throw lastError
  }

  function handlePasswordFinish(passwordToken: string) {
    passwordTokenRef.current = passwordToken
    setIsPasswordChecked(true)
  }

  function buildHiddenFieldAnswers(): HiddenFieldAnswer[] {
    return (form.hiddenFields || [])
      .map(field => {
        const value = query[field.name]

        if (helper.isValid(value)) {
          return {
            ...field,
            value
          }
        }
      })
      .filter(Boolean) as HiddenFieldAnswer[]
  }

  async function handleLeadCapture(values: Record<string, any>) {
    if (!openTokenRef.current) {
      return
    }

    try {
      await EndpointService.captureLeadSubmission({
        formId: form.id,
        answers: values,
        hiddenFields: buildHiddenFieldAnswers(),
        openToken: openTokenRef.current,
        passwordToken: passwordTokenRef.current
      })
    } catch (error) {
      console.error(error)
    }
  }

  async function handleSubmit(values: Any, partialSubmission?: boolean, stripe?: Any) {
    try {
      flushActiveQuestion(true)
      await syncSession().catch(console.error)

      let token: Record<string, Any> = {}

      if (form.settings?.captchaKind === CaptchaKindEnum.GOOGLE_RECAPTCHA) {
        await ensureCaptchaReady()
        token.recaptchaToken = await recaptchaToken(captchaRef)
      }

      const file = await new Uploader(form, values).start()

      const hiddenFields = buildHiddenFieldAnswers()

      const { clientSecret } = await EndpointService.completeSubmission({
        formId: form.id,
        contactId,
        answers: {
          ...values,
          ...file
        },
        hiddenFields,
        openToken: openTokenRef.current,
        passwordToken: passwordTokenRef.current,
        partialSubmission,
        ...(token || {})
      })

      if (stripe && helper.isValid(clientSecret)) {
        const paymentField = form.fields?.find(f => f.kind === FieldKindEnum.PAYMENT)

        if (paymentField) {
          const result = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
              card: stripe.elements.getElement('cardNumber'),
              billing_details: values[paymentField.id]?.billingDetails
            }
          })

          if (result.error) {
            throw new Error(result.error.message)
          }
        }
      }

      sendMessageToParent('FORM_SUBMITTED')
      trackPublicEvent(form, 'heyform_submit')
    } catch (err: Any) {
      /**
       * Throw error to let Renderer knows that there was an error.
       * If we don't do this, the form will be show as submitted
       */
      throw err
    }
  }

  async function initCaptcha() {
    // reCAPTCHA initializes lazily on submit.
  }

  useEffect(() => {
    sendMessageToParent('FORM_LOADED')

    if (!form.suspended && form.settings?.active) {
      ensureGa4(form.integrations?.googleanalytics4)
      ensureGtm(form.integrations?.googletagmanager)
      ensureMetaPixel(form.integrations?.metapixel)
      void openForm().catch(console.error)
      initCaptcha().catch(console.error)
    }
  }, [])

  useEffect(() => {
    function handlePageHide() {
      syncSessionOnBackground()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        syncSessionOnBackground()
      } else if (
        document.visibilityState === 'visible' &&
        activeQuestionRef.current &&
        !activeQuestionStartedAtRef.current
      ) {
        activeQuestionStartedAtRef.current = Date.now()
      }
    }

    window.addEventListener('pagehide', handlePageHide)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('pagehide', handlePageHide)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  if (form.settings?.requirePassword && !isPasswordChecked) {
    return <PasswordCheck form={form} onFinish={handlePasswordFinish} />
  }

  const theme = getTheme(form.themeSettings?.theme)
  const fontURL = getWebFontURL(theme.fontFamily)

  return (
    <>
      {helper.isValid(fontURL) && <link href={fontURL} rel="stylesheet" />}
      <style dangerouslySetInnerHTML={{ __html: getThemeStyle(theme, query) }} />

      {isStripeEnabled(form) && <script id="stripe" src="https://js.stripe.com/v3/" />}

      <FormRenderer
        form={form as Any}
        query={query}
        locale={locale}
        stripeApiKey={(form as Any).stripe?.publishableKey}
        stripeAccountId={(form as Any).stripe?.accountId}
        autoSave={!(form.settings?.enableTimeLimit && helper.isValid(form.settings?.timeLimit))}
        alwaysShowNextButton={!form.settings?.autoAdvanceSingleChoice}
        customUrlRedirects={(form.settings as Any)?.customUrlRedirects ?? true}
        enableQuestionList={form.settings?.enableQuestionList}
        enableNavigationArrows={form.settings?.enableNavigationArrows}
        onQuestionChange={handleQuestionChange}
        onLeadCapture={handleLeadCapture}
        onSubmit={handleSubmit}
      />

      {/* Custom css */}
      {helper.isValid(form.themeSettings?.theme?.customCSS) && (
        <style dangerouslySetInnerHTML={{ __html: form.themeSettings!.theme!.customCSS! }} />
      )}
    </>
  )
}
