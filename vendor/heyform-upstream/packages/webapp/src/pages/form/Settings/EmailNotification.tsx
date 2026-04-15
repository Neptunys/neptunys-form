import { useTranslation } from 'react-i18next'

import { FieldKindEnum } from '@heyform-inc/shared-types-enums'

import { Form, Input, Select, Switch } from '@/components'
import { useFormStore } from '@/store'

export default function FormSettingsEmailNotification() {
  const { t } = useTranslation()
  const { form, formFields } = useFormStore()

  const scoreVariableOptions = (form?.variables || [])
    .filter(variable => variable.kind === 'number')
    .map(variable => ({
      value: variable.id,
      label: variable.name
    }))

  const respondentNameOptions = formFields
    .filter(field => [FieldKindEnum.FULL_NAME, FieldKindEnum.CONTACT_INFO, FieldKindEnum.SHORT_TEXT].includes(field.kind))
    .map(field => ({
      value: field.id,
      label: field.title || field.id
    }))

  const respondentEmailOptions = formFields
    .filter(field => [FieldKindEnum.EMAIL, FieldKindEnum.CONTACT_INFO].includes(field.kind))
    .map(field => ({
      value: field.id,
      label: field.title || field.id
    }))

  const respondentPhoneOptions = formFields
    .filter(field => [FieldKindEnum.PHONE_NUMBER, FieldKindEnum.CONTACT_INFO].includes(field.kind))
    .map(field => ({
      value: field.id,
      label: field.title || field.id
    }))

  const templateFooter =
    'Supported tokens: {formName}, {respondentName}, {respondentEmail}, {respondentPhone}, {leadScore}, {leadQuality}, {leadPriority}, {submittedAt}, {submissionId}. {leadQuality} follows your configured grade labels and {leadPriority} follows your configured priority labels.'

  return (
    <section id="emailNotification" className="pt-10">
      <h2 className="hf-section-title">Lead flow and notifications</h2>

      <div className="mt-4 space-y-8">
        <Form.Item
          className="[&_[data-slot=content]]:pt-1.5"
          name="enableEmailNotification"
          label={t('form.settings.emailNotification.self.headline')}
          description={t('form.settings.emailNotification.self.subHeadline')}
          isInline
        >
          <Switch />
        </Form.Item>

        <div className="grid gap-6 md:grid-cols-2">
          <Form.Item
            className="md:col-span-2 [&_[data-slot=content]]:pt-1.5"
            name="enableLeadScoring"
            label="Scoring and grading"
            description="Use a numeric submission variable as the score source for exports, emails, Google Sheets, and downstream automations."
            isInline
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="leadScoreVariableId"
            label="Score variable"
            footer="Leave this blank to let Heyform auto-detect a numeric score variable when possible."
          >
            <Select
              className="w-full"
              allowClear
              placeholder="Select a numeric variable"
              options={scoreVariableOptions}
              contentProps={{
                position: 'popper'
              }}
            />
          </Form.Item>

          <div className="grid gap-4 sm:grid-cols-2">
            <Form.Item name="leadMediumThreshold" label="Medium threshold">
              <Input type="number" placeholder="50" />
            </Form.Item>

            <Form.Item name="leadHighThreshold" label="High threshold">
              <Input type="number" placeholder="80" />
            </Form.Item>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 md:col-span-2">
            <Form.Item
              name="leadQualityLowLabel"
              label="Low grade label"
              footer="Used in exports, monthly reports, and notification templates via {leadQuality}."
            >
              <Input placeholder="Low fit" />
            </Form.Item>

            <Form.Item name="leadQualityMediumLabel" label="Medium grade label">
              <Input placeholder="Review" />
            </Form.Item>

            <Form.Item name="leadQualityHighLabel" label="High grade label">
              <Input placeholder="Qualified" />
            </Form.Item>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 md:col-span-2">
            <Form.Item
              name="leadPriorityLowLabel"
              label="Low priority label"
              footer="Used in exports, monthly reports, and notification templates via {leadPriority}."
            >
              <Input placeholder="Cold" />
            </Form.Item>

            <Form.Item name="leadPriorityMediumLabel" label="Medium priority label">
              <Input placeholder="Warm" />
            </Form.Item>

            <Form.Item name="leadPriorityHighLabel" label="High priority label">
              <Input placeholder="Hot" />
            </Form.Item>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Form.Item
            name="respondentNameFieldId"
            label="Respondent name field"
            footer="Used in confirmation emails and lead payloads."
          >
            <Select
              className="w-full"
              allowClear
              placeholder="Auto-detect"
              options={respondentNameOptions}
              contentProps={{
                position: 'popper'
              }}
            />
          </Form.Item>

          <Form.Item
            name="respondentEmailFieldId"
            label="Respondent email field"
            footer="Required for respondent confirmation emails."
          >
            <Select
              className="w-full"
              allowClear
              placeholder="Auto-detect"
              options={respondentEmailOptions}
              contentProps={{
                position: 'popper'
              }}
            />
          </Form.Item>

          <Form.Item
            name="respondentPhoneFieldId"
            label="Respondent phone field"
            footer="Included in operator alerts and downstream payloads."
          >
            <Select
              className="w-full"
              allowClear
              placeholder="Auto-detect"
              options={respondentPhoneOptions}
              contentProps={{
                position: 'popper'
              }}
            />
          </Form.Item>
        </div>

        <Form.Item
          className="[&_[data-slot=content]]:pt-1.5"
          name="trackLeadOnCapture"
          label="Count lead on contact capture"
          description="Installed pixels fire their lead event as soon as a valid email or phone number is captured. Leave this off to wait for a successful submission and thank-you step."
          isInline
        >
          <Switch />
        </Form.Item>

        <div className="space-y-6 rounded-2xl border border-zinc-200/70 p-5">
          <Form.Item
            className="[&_[data-slot=content]]:pt-1.5"
            name="enableRespondentNotification"
            label="Respondent confirmation email"
            description="Send an automatic confirmation email to the submitter when an email answer is present."
            isInline
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="respondentNotificationSubject"
            label="Respondent email subject"
            footer={templateFooter}
          >
            <Input placeholder="We received your submission for {formName}" />
          </Form.Item>

          <Form.Item
            name="respondentNotificationMessage"
            label="Respondent email message"
            footer={templateFooter}
          >
            <Input.TextArea
              rows={6}
              placeholder={'Hi {respondentName},\n\nThanks for your submission to {formName}. We received it on {submittedAt}.'}
            />
          </Form.Item>
        </div>

        <div className="space-y-6 rounded-2xl border border-zinc-200/70 p-5">
          <Form.Item
            className="[&_[data-slot=content]]:pt-1.5"
            name="enableOperatorNotification"
            label="Operator lead alerts"
            description="Send an internal email with score, priority, and submission answers to your team."
            isInline
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="operatorNotificationEmailsText"
            label="Operator recipients"
            footer="One email address per line. Workspace default lead recipients are appended automatically."
          >
            <Input.TextArea rows={5} placeholder={'sales@example.com\nops@example.com'} />
          </Form.Item>

          <Form.Item
            name="operatorNotificationSubject"
            label="Operator email subject"
            footer={templateFooter}
          >
            <Input placeholder="New lead for {formName}: {leadPriority} priority" />
          </Form.Item>

          <Form.Item
            name="operatorNotificationMessage"
            label="Operator email message"
            footer={`${templateFooter} The full submission is appended automatically below this message.`}
          >
            <Input.TextArea
              rows={6}
              placeholder={
                'A new lead was captured for {formName}.\n\nName: {respondentName}\nEmail: {respondentEmail}\nScore: {leadScore}\nPriority: {leadPriority}'
              }
            />
          </Form.Item>
        </div>
      </div>
    </section>
  )
}
