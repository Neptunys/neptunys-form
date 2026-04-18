import Router, { Route } from '@heyooo-inc/react-router'
import * as Tooltip from '@radix-ui/react-tooltip'
import { ReactNode, useEffect } from 'react'
import { Root, createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'

import { getAuthState, getDeviceId, setCookie, setDeviceId } from '@/utils'

import { Toaster } from '@/components'
import { REDIRECT_COOKIE_NAME } from '@/consts'
import '@/i18n'
import { AuthLayout } from '@/layouts'
import '@/styles/globals.scss'

if (!getDeviceId()) {
  setDeviceId()
}

const DASHBOARD_BASE_URL =
  (window.heyform?.homepageURL as string) ||
  (import.meta.env.VITE_DASHBOARD_URL as string) ||
  window.location.origin

function getDashboardHref(pathname: string) {
  try {
    return new URL(pathname, DASHBOARD_BASE_URL).toString()
  } catch (_) {
    return pathname
  }
}

const LOGIN_HREF = getDashboardHref('/login')
const LOGOUT_HREF = getDashboardHref('/logout')
const HOME_HREF = getDashboardHref('/')

function renderFatalScreen(message?: string) {
  const container = document.getElementById('root')

  if (!container) {
    return
  }

  const safeMessage = String(message || 'Unexpected application error').replace(/[<>&]/g, char => {
    switch (char) {
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '&':
        return '&amp;'
      default:
        return char
    }
  })

  const logoutHref = LOGOUT_HREF
  const loginHref = LOGIN_HREF

  container.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#f5f7fb;color:#0f172a;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="width:100%;max-width:560px;background:#ffffff;border:1px solid #dbe1ea;border-radius:20px;padding:24px;box-shadow:0 12px 40px rgba(15,23,42,.08);text-align:center;">
        <h1 style="margin:0 0 12px;font-size:30px;line-height:1.1;">App failed to load</h1>
        <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.6;">The app hit a runtime error. Reset the session and reopen the login flow.</p>
        <div style="margin:0 auto 18px;max-width:440px;padding:12px 14px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;color:#334155;font-size:13px;line-height:1.5;word-break:break-word;">${safeMessage}</div>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
          <a href="${logoutHref}" style="display:inline-flex;align-items:center;justify-content:center;min-width:160px;padding:12px 18px;border-radius:12px;background:#0f172a;color:#fff;text-decoration:none;font-weight:600;">Reset Session</a>
          <a href="${loginHref}" style="display:inline-flex;align-items:center;justify-content:center;min-width:160px;padding:12px 18px;border-radius:12px;background:#fff;color:#0f172a;text-decoration:none;font-weight:600;border:1px solid #cbd5e1;">Open Login</a>
        </div>
      </div>
    </div>
  `
}

function shouldIgnoreHandledRequestRejection(reason: any) {
  const graphQLErrors = Array.isArray(reason?.graphQLErrors) ? reason.graphQLErrors : []

  if (graphQLErrors.length > 0) {
    return graphQLErrors.every(error => {
      const code = error?.extensions?.code || error?.code
      const status = Number(
        error?.extensions?.status || error?.status || reason?.networkError?.statusCode || reason?.networkError?.status
      )

      if (code === 'INTERNAL_SERVER_ERROR' || status >= 500) {
        return false
      }

      return true
    })
  }

  const status = Number(reason?.networkError?.statusCode || reason?.networkError?.status || reason?.status)
  return Number.isFinite(status) && status > 0 && status < 500
}

const Fallback = ({ error }: { error?: Error }) => {
  const { t } = useTranslation()

  return (
    <AuthLayout>
      <h1 className="text-center text-2xl font-semibold">{t('components.error.title')}</h1>
      <p className="text-secondary text-center text-sm/6">{t('components.error.message')}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <a
          href={LOGOUT_HREF}
          className="inline-flex min-w-40 items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
        >
          Reset session
        </a>
        <a
          href={LOGIN_HREF}
          className="inline-flex min-w-40 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900"
        >
          Open login
        </a>
      </div>
      {error?.message && (
        <p className="text-secondary mt-4 text-center text-xs/6 break-words">{error.message}</p>
      )}
    </AuthLayout>
  )
}

const RedirectNotice = ({
  title,
  message,
  href,
  label
}: {
  title: string
  message: string
  href: string
  label: string
}) => (
  <AuthLayout>
    <h1 className="text-center text-2xl font-semibold">{title}</h1>
    <p className="text-secondary text-center text-sm/6">{message}</p>
    <div className="mt-6 flex flex-wrap justify-center gap-3">
      <a
        href={href}
        className="inline-flex min-w-40 items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
      >
        {label}
      </a>
    </div>
  </AuthLayout>
)

const RedirectScreen = ({
  to,
  replace = false,
  title,
  message,
  label
}: {
  to: string
  replace?: boolean
  title: string
  message: string
  label: string
}) => {
  useEffect(() => {
    if (replace) {
      window.location.replace(to)
    } else {
      window.location.assign(to)
    }
  }, [replace, to])

  return <RedirectNotice title={title} message={message} href={to} label={label} />
}

const App = ({ routes }: { routes: Route[] }) => {
  function render(options?: any, children?: ReactNode) {
    const isLoggedIn = getAuthState()

    if (options?.loginRequired) {
      if (!isLoggedIn) {
        const redirectUri = window.location.pathname + window.location.search

        setCookie(REDIRECT_COOKIE_NAME, redirectUri, {})
        return (
          <RedirectScreen
            to={LOGIN_HREF}
            replace
            title="Redirecting to login"
            message="Sign in first to open the workspace dashboard."
            label="Open login"
          />
        )
      }
    } else {
      if (isLoggedIn && options?.redirectIfLogged) {
        return (
          <RedirectScreen
            to={HOME_HREF}
            replace
            title="Redirecting to workspace"
            message="Your session is active. Opening the workspace home page."
            label="Open workspace"
          />
        )
      } else {
        return children
      }
    }
  }

  return (
    <ErrorBoundary fallbackRender={({ error }) => <Fallback error={error} />}>
      <Tooltip.Provider>
        <Router routes={routes} render={render} />
      </Tooltip.Provider>
      <Toaster />
    </ErrorBoundary>
  )
}

let root: Root | undefined

const RUNTIME_CONFIG_KEYS = [
  'homepageURL',
  'websiteURL',
  'customDomainRuntime',
  'cookieDomain',
  'stripePublishableKey',
  'googleRecaptchaKey',
  'templatesURL',
  'helpCenterURL',
  'appDisableRegistration',
  'disableLoginWithGoogle',
  'disableLoginWithApple',
  'verifyUserEmail'
]

function hasInjectedRuntimeConfig() {
  const runtimeConfig = window.heyform

  if (!runtimeConfig) {
    return false
  }

  return RUNTIME_CONFIG_KEYS.some(key => typeof (runtimeConfig as any)[key] !== 'undefined')
}

async function loadRuntimeConfig() {
  if (hasInjectedRuntimeConfig()) {
    return
  }

  try {
    const response = await fetch('/api/config', {
      credentials: 'include'
    })

    if (response.ok) {
      const config = await response.json()

      window.heyform = {
        ...(window.heyform || {}),
        ...config
      }
    }
  } catch (_) {}
}

async function bootstrap() {
  try {
    await loadRuntimeConfig()

    const { default: routes } = await import('@/routes')
    const container = document.getElementById('root')!

    if (!root) {
      root = createRoot(container)
    }

    root.render(<App routes={routes as Route[]} />)
  } catch (err: any) {
    renderFatalScreen(err?.message)
  }
}

window.addEventListener('error', event => {
  renderFatalScreen(event.error?.message || event.message)
})

window.addEventListener('unhandledrejection', event => {
  const reason = event.reason as any

  if (shouldIgnoreHandledRequestRejection(reason)) {
    event.preventDefault()
    return
  }

  renderFatalScreen(reason?.message || String(reason || 'Unhandled promise rejection'))
})

bootstrap()
