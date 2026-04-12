export default {
  id: 'googletagmanager',
  name: 'Google Tag Manager',
  description:
    'Inject a GTM container on the public form so you can manage downstream tags and events centrally.',
  icon: '/static/webhook.png',
  settings: [
    {
      type: 'text',
      name: 'containerId',
      label: 'Container ID',
      placeholder: 'GTM-XXXXXXX',
      required: true
    }
  ]
}