export default {
  id: 'metapixel',
  name: 'Meta Pixel',
  description:
    'Track page views and lead submissions with the Meta Pixel on every public form response flow.',
  icon: '/static/webhook.png',
  settings: [
    {
      type: 'text',
      name: 'pixelId',
      label: 'Pixel ID',
      placeholder: '123456789012345',
      required: true
    }
  ]
}