import type { FC } from 'react'

import { useTranslation } from '../utils'
import { helper } from '@neptunysform-inc/utils'

import { ConsentCheckbox, FormField } from '../components'
import { useStore } from '../store'
import type { BlockProps } from './Block'
import { Block } from './Block'
import { Form } from './Form'

export const LegalTerms: FC<BlockProps> = ({ field, ...restProps }) => {
  const { state } = useStore()
  const { t } = useTranslation()
  const consentText =
    field.properties?.consentText || 'I agree to the terms and privacy policy.'
  const consentLinkLabel = field.properties?.consentLinkLabel
  const consentLinkUrl = field.properties?.consentLinkUrl
  const hasStoredValue = Object.prototype.hasOwnProperty.call(state.values, field.id)
  const initialValue = hasStoredValue
    ? helper.isTrue(state.values[field.id])
    : helper.isTrue(field.properties?.defaultChecked)

  function getValues(values: any) {
    return helper.isTrue(values.input)
  }

  return (
    <Block className="neptunysform-legal-terms" field={field} {...restProps}>
      <Form
        initialValues={{
          input: initialValue
        }}
        isSubmitShow={true}
        field={field}
        getValues={getValues}
      >
        <FormField
          name="input"
          rules={[
            {
              validator: (_, value) => {
                if (field.validations?.required && !helper.isTrue(value)) {
                  return Promise.reject(t('This field is required'))
                }

                return Promise.resolve()
              }
            }
          ]}
        >
          <ConsentCheckbox
            label={consentText}
            linkLabel={consentLinkLabel}
            linkUrl={consentLinkUrl}
          />
        </FormField>
      </Form>
    </Block>
  )
}
