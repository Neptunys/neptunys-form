import type { FC } from 'react'

import { getPrefilledEmail, initialValue, useTranslation } from '../utils'

import { FormField, Input } from '../components'
import { useStore } from '../store'
import type { BlockProps } from './Block'
import { Block } from './Block'
import { Form } from './Form'

export const Email: FC<BlockProps> = ({ field, ...restProps }) => {
  const { state } = useStore()
  const { t } = useTranslation()
  const prefilledEmail = getPrefilledEmail(state.query)

  function getValues(values: any) {
    return values.input
  }

  return (
    <Block className="heyform-email" field={field} {...restProps}>
      <Form
        initialValues={{
          input: initialValue(state.values[field.id]) ?? prefilledEmail
        }}
        autoComplete="on"
        field={field}
        getValues={getValues}
      >
        <FormField
          name="input"
          rules={[
            {
              required: field.validations?.required,
              type: 'email',
              message: t('This field is required')
            }
          ]}
        >
          <Input name="email" autoComplete="email" type="email" placeholder="email@example.com" />
        </FormField>
      </Form>
    </Block>
  )
}
