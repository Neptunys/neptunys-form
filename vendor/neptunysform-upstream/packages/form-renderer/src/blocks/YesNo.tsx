import type { FC } from 'react'

import { isNotNil, useTranslation } from '../utils'
import { helper } from '@neptunysform-inc/utils'

import { FormField, RadioGroup } from '../components'
import { useStore } from '../store'
import type { BlockProps } from './Block'
import { Block } from './Block'
import { Form } from './Form'

export const YesNo: FC<BlockProps> = ({ field, ...restProps }) => {
  const { state } = useStore()
  const { t } = useTranslation()
  const autoAdvanceSingleChoice = helper.isTrue(state.settings?.autoAdvanceSingleChoice)

  const options = [
    {
      keyName: 'Y',
      label: t('Yes'),
      value: field.properties?.choices?.find(c => c.label === 'Yes')?.id
    },
    {
      keyName: 'N',
      label: t('No'),
      value: field.properties?.choices?.find(c => c.label === 'No')?.id
    }
  ]

  function getValues(values: any) {
    return values.input ? values.input[0] : undefined
  }

  return (
    <Block className="neptunysform-yes-no" field={field} {...restProps}>
      <Form
        initialValues={{
          input: [state.values[field.id]].filter(isNotNil)
        }}
        autoSubmit={autoAdvanceSingleChoice}
        autoSubmitDelayMs={autoAdvanceSingleChoice ? 420 : 80}
        allowAutoSubmitWithNextButton={autoAdvanceSingleChoice}
        isSubmitShow={true}
        field={field}
        getValues={getValues}
      >
        <FormField
          name="input"
          rules={[
            {
              required: field.validations?.required,
              message: t('This field is required')
            }
          ]}
        >
          <RadioGroup
            className="w-full"
            options={options}
            selectionFeedback={autoAdvanceSingleChoice}
          />
        </FormField>
      </Form>
    </Block>
  )
}
