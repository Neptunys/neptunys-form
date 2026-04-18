import { useState } from 'react'

import { getPreferredLanguage } from './utils/brower-language'
import { FormService } from '@/services'
import { PublicFormType, PublicRenderType } from '@/types'
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
  const previewVariantFormId =
    typeof query.variant === 'string'
      ? query.variant
      : Array.isArray(query.variant)
        ? query.variant[0]
        : undefined

  async function fetchData() {
    const result = (await FormService.publicRender({
      formId,
      experimentId,
      hostname: window.location.hostname,
      slug: resolveDomainRoot ? undefined : publicSlug,
      previewVariantFormId
    })) as PublicRenderType

    setForm(result.form)
    setActiveExperimentId(previewVariantFormId ? undefined : result.experimentId)
    setLocale(resolveRenderLocale(result.form))

    return true
  }

  return (
    <Async
      fetch={fetchData}
      loader={
        <PublicRouteState
          title="Loading form"
          message="Connecting to the published page..."
        />
      }
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
