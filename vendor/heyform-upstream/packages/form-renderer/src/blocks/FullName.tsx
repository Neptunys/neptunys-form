import clsx from 'clsx'
import type { FC } from 'react'

import { initialValue, useTranslation } from '../utils'
import { helper } from '@heyform-inc/utils'

import { FormField, Input } from '../components'
import { useStore } from '../store'
import type { BlockProps } from './Block'
import { Block } from './Block'
import { Form } from './Form'

export const FullName: FC<BlockProps> = ({ field, ...restProps }) => {
  const { state } = useStore()
  const { t } = useTranslation()
  const fullNameMode = field.properties?.fullNameMode || 'both'
  const showFirstName = fullNameMode !== 'last'
  const showLastName = fullNameMode !== 'first'
  const showBothFields = showFirstName && showLastName

  function getValues(values: any) {
    return helper.isValid(values?.firstName) || helper.isValid(values?.lastName)
      ? values
      : undefined
  }

  return (
    <Block className="heyform-full-name" field={field} {...restProps}>
      <Form
        initialValues={initialValue(state.values[field.id])}
        field={field}
        getValues={getValues}
      >
        <div
          className={clsx('flex w-full items-start justify-items-stretch', {
            'space-x-4': showBothFields
          })}
        >
          {showFirstName && (
            <FormField
              className={showBothFields ? 'flex-1' : 'w-full'}
              name="firstName"
              rules={[
                {
                  required: field.validations?.required && showFirstName,
                  message: t('This field is required')
                }
              ]}
            >
              <Input placeholder={t('First Name')} />
            </FormField>
          )}

          {showLastName && (
            <FormField
              className={showBothFields ? 'flex-1' : 'w-full'}
              name="lastName"
              rules={[
                {
                  required: field.validations?.required && showLastName,
                  message: t('This field is required')
                }
              ]}
            >
              <Input placeholder={t('Last Name')} />
            </FormField>
          )}
        </div>
      </Form>
    </Block>
  )
}
