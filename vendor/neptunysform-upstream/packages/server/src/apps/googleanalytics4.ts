export default {
  id: 'googleanalytics4',
  name: 'Google Analytics 4',
  description:
    'Install GA4 on the public form and emit view and submit events so you can measure conversion in Google Analytics.',
  icon: '/static/webhook.png',
  settings: [
    {
      type: 'text',
      name: 'measurementId',
      label: 'Measurement ID',
      placeholder: 'G-XXXXXXXXXX',
      required: true
    }
  ]
}