import got from 'got'

export default {
  id: 'zapier',
  name: 'Zapier',
  description:
    'Send every submission straight into a Zapier Catch Hook and continue the workflow in Google Sheets, email, CRMs, and more.',
  icon: '/static/webhook.png',
  settings: [
    {
      type: 'url',
      name: 'endpointUrl',
      label: 'Zapier webhook URL',
      placeholder: 'https://hooks.zapier.com/hooks/catch/...',
      required: true
    }
  ],
  run: async ({ config, submission, form }) => {
    return got
      .post(config.endpointUrl, {
        json: {
          id: submission.id,
          formId: form.id,
          formName: form.name,
          fields: form.fields,
          answers: submission.answers,
          hiddenFields: submission.hiddenFields,
          variables: submission.variables
        }
      })
      .text()
  }
}