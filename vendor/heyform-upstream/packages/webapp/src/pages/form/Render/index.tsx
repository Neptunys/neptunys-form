import { useState } from 'react'

import { getPreferredLanguage } from './utils/brower-language'
import { FormService } from '@/services'
import { PublicFormType } from '@/types'
import { useParam, useQuery } from '@/utils'

import { Async } from '@/components'
import '@/styles/render.scss'

import { Renderer } from './components/Renderer'

const LANGUAGES = ['en', 'de', 'fr', 'pl', 'ja', 'zh-cn', 'zh-tw']

function resolveRenderLocale(form: PublicFormType) {
  const primaryLocale = form.settings.locale || LANGUAGES[0]
  const enabledTranslations = Array.isArray(form.settings.languages) ? form.settings.languages : []
  const preferredLocale = getPreferredLanguage(LANGUAGES, primaryLocale)

  if (preferredLocale === primaryLocale) {
    return primaryLocale
  }

  return enabledTranslations.includes(preferredLocale) ? preferredLocale : primaryLocale
}

const PublicRouteState = ({ title, message }: { title: string; message: string }) => (
  <div className="flex min-h-screen items-center justify-center px-6 py-10">
    <div className="border-accent-light bg-foreground w-full max-w-xl rounded-3xl border p-8 text-center shadow-sm">
      <h1 className="text-primary text-3xl font-semibold">{title}</h1>
      <p className="text-secondary mt-3 text-sm/6">{message}</p>
    </div>
  </div>
)

export default function FormRender({ resolveDomainRoot = false }: { resolveDomainRoot?: boolean }) {
  const { formId, experimentId, publicSlug } = useParam()
  const query = useQuery()

  const [form, setForm] = useState<PublicFormType | null>(null)
  const [activeExperimentId, setActiveExperimentId] = useState<string | undefined>(experimentId)
  const [locale, setLocale] = useState<string>()

  async function fetchData() {
    let resolvedFormId = formId
    let resolvedExperimentId = experimentId

    if (!resolvedFormId && !resolvedExperimentId) {
      const publicRoute = await FormService.publicRouteByDomain(
        window.location.hostname,
        resolveDomainRoot ? undefined : publicSlug
      )

      if (publicRoute?.kind === 'experiment' && publicRoute.experimentId) {
        resolvedExperimentId = publicRoute.experimentId
      }

      if (publicRoute?.kind === 'form' && publicRoute.formId) {
        resolvedFormId = publicRoute.formId
      }
    }

    if (!resolvedFormId && resolvedExperimentId) {
      const experiment = await FormService.publicExperiment(resolvedExperimentId)
      resolvedFormId = experiment.formId
    }

    const result = resolvedFormId
      ? await FormService.publicForm(resolvedFormId)
      : await FormService.publicFormByDomain(
          window.location.hostname,
          resolveDomainRoot ? undefined : publicSlug
        )

    setForm(result)
      setActiveExperimentId(resolvedExperimentId)
    setLocale(resolveRenderLocale(result))

    return true
  }

  return (
    <Async
      fetch={fetchData}
      errorRender={(error: Error) => (
        <PublicRouteState
          title="Page not found"
          message={error.message || 'There is no published page connected to this address yet.'}
        />
      )}
    >
      {form && (
        <div id="heyform-render-root">
          <Renderer form={form} query={query} locale={locale!} experimentId={activeExperimentId} />
        </div>
      )}
    </Async>
  )
}
