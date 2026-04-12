import type { FC } from 'react'

import { useTranslation } from '../utils'
import { helper } from '@heyform-inc/utils'

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

  function getValues(values: any) {
    return helper.isTrue(values.input) ? true : undefined
  }

  return (
    <Block className="heyform-legal-terms" field={field} {...restProps}>
      <Form
        initialValues={{
          input: helper.isTrue(state.values[field.id])
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
          <ConsentCheckbox label={consentText} />
        </FormField>
      </Form>
    </Block>
  )
}
