import { useTranslation } from 'react-i18next'

import { Form, Select, Switch } from '@/components'

const PROGRESS_STYLE_OPTIONS = [
  {
    value: 'circular',
    label: 'Current progress chip'
  },
  {
    value: 'top-bar',
    label: 'Top bar progress'
  }
]

export default function FormSettingsGeneral() {
  const { t } = useTranslation()

  return (
    <section id="general">
      <h2 className="hf-section-title">{t('form.settings.general.title')}</h2>

      <div className="mt-4 space-y-8">
        <Form.Item
          className="[&_[data-slot=content]]:pt-1.5"
          name="allowArchive"
          label={t('form.settings.general.archive.headline')}
          description={t('form.settings.general.archive.subHeadline')}
          isInline
        >
          <Switch />
        </Form.Item>

        <Form.Item
          className="[&_[data-slot=content]]:pt-1.5"
          name="enableProgress"
          label={t('form.settings.general.progressBar.headline')}
          description={t('form.settings.general.progressBar.subHeadline')}
          isInline
        >
          <Switch />
        </Form.Item>

        <Form.Item name="progressStyle" label="Progress style">
          <Select
            className="w-full"
            options={PROGRESS_STYLE_OPTIONS}
            contentProps={{
              position: 'popper'
            }}
          />
        </Form.Item>

        <Form.Item
          className="[&_[data-slot=content]]:pt-1.5"
          name="autoAdvanceSingleChoice"
          label="Auto-advance single choice"
          description="Go straight to the next screen when a single-answer option is selected."
          isInline
        >
          <Switch />
        </Form.Item>

        <Form.Item
          className="[&_[data-slot=content]]:pt-1.5"
          name="enableQuestionNumbers"
          label="Show question numbers"
          description="Display the small step number before each page title in the live form and builder preview."
          isInline
        >
          <Switch />
        </Form.Item>

        <Form.Item
          className="[&_[data-slot=content]]:pt-1.5"
          name="enableQuestionList"
          label={t('form.settings.general.viewQuestions.headline')}
          description={t('form.settings.general.viewQuestions.subHeadline')}
          isInline
        >
          <Switch />
        </Form.Item>

        <Form.Item
          className="[&_[data-slot=content]]:pt-1.5"
          name="enableNavigationArrows"
          label={t('form.settings.general.navigationArrows.headline')}
          description={t('form.settings.general.navigationArrows.subHeadline')}
          isInline
        >
          <Switch />
        </Form.Item>
      </div>
    </section>
  )
}
