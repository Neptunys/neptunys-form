import { useState } from 'react'

import { getPreferredLanguage } from './utils/brower-language'
import { FormService } from '@/services'
import { PublicFormType } from '@/types'
import { useParam, useQuery } from '@/utils'

import { Async } from '@/components'
import '@/styles/render.scss'

import { Renderer } from './components/Renderer'

const LANGUAGES = ['en', 'de', 'fr', 'pl', 'ja', 'zh-cn', 'zh-tw']

export default function FormRender() {
  const { formId, experimentId } = useParam()
  const query = useQuery()

  const [form, setForm] = useState<PublicFormType | null>(null)
  const [locale, setLocale] = useState<string>()

  async function fetchData() {
    let resolvedFormId = formId

    if (!resolvedFormId && experimentId) {
      const experiment = await FormService.publicExperiment(experimentId)
      resolvedFormId = experiment.formId
    }

    const result = await FormService.publicForm(resolvedFormId)

    setForm(result)
    setLocale(getPreferredLanguage(LANGUAGES, result.settings.locale || LANGUAGES[0]))

    return true
  }

  return (
    <Async fetch={fetchData}>
      {form && (
        <div id="heyform-render-root">
          <Renderer form={form} query={query} locale={locale!} experimentId={experimentId} />
        </div>
      )}
    </Async>
  )
}
