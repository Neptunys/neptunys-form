import { Form, Input, Select, Switch } from '@/components'
import { AppSettingType } from '@/types'

const GOOGLE_SHEETS_ROUTE_SETTING_NAMES = new Set([
  'spreadsheetIdHigh',
  'sheetNameHigh',
  'spreadsheetIdMedium',
  'sheetNameMedium',
  'spreadsheetIdLow',
  'sheetNameLow'
])

export function getVisibleIntegrationSettings(
  appId: string | undefined,
  settings: AppSettingType[] | undefined,
  values: Record<string, any>
) {
  return (settings || []).filter(setting => {
    if (appId === 'googlesheets' && GOOGLE_SHEETS_ROUTE_SETTING_NAMES.has(setting.name)) {
      return Boolean(values.routeByLeadLevel)
    }

    return true
  })
}

export default function IntegrationSettingsItem({ setting }: { setting: AppSettingType }) {
  switch (setting.type) {
    case 'text':
      return (
        <Form.Item
          name={setting.name}
          label={setting.label}
          footer={setting.description}
          rules={[
            {
              required: setting.required
            }
          ]}
        >
          <Input placeholder={setting.placeholder} />
        </Form.Item>
      )

    case 'url':
      return (
        <Form.Item
          name={setting.name}
          label={setting.label}
          footer={setting.description}
          rules={[
            {
              type: 'url',
              required: setting.required
            }
          ]}
        >
          <Input placeholder={setting.placeholder} />
        </Form.Item>
      )

    case 'textarea':
      return (
        <Form.Item
          name={setting.name}
          label={setting.label}
          footer={setting.description}
          rules={[
            {
              required: setting.required
            }
          ]}
        >
          <Input.TextArea rows={6} placeholder={setting.placeholder} />
        </Form.Item>
      )

    case 'select':
      return (
        <Form.Item
          name={setting.name}
          label={setting.label}
          footer={setting.description}
          rules={[
            {
              required: setting.required
            }
          ]}
        >
          <Select options={setting.options || []} placeholder={setting.placeholder} />
        </Form.Item>
      )

    case 'switch':
      return (
        <Form.Item name={setting.name} label={setting.label} footer={setting.description} isInline>
          <Switch />
        </Form.Item>
      )

    default:
      return null
  }
}
