import got from 'got'

import { buildLeadCapturePayload } from '../utils'

export default {
  id: 'n8n',
  name: 'n8n',
  description:
    'Send each submission to an n8n webhook so you can route form data into self-hosted automation workflows.',
  icon: '/static/webhook.png',
  settings: [
    {
      type: 'url',
      name: 'endpointUrl',
      label: 'n8n webhook URL',
      placeholder: 'https://n8n.example.com/webhook/...',
      required: true
    }
  ],
  run: async ({ config, submission, form }) => {
    const lead = buildLeadCapturePayload(form, submission)

    return got
      .post(config.endpointUrl, {
        json: {
          id: submission.id,
          formId: form.id,
          formName: form.name,
          fields: form.fields,
          answers: submission.answers,
          hiddenFields: submission.hiddenFields,
          variables: submission.variables,
          lead
        }
      })
      .text()
  }
}