import type { CSSProperties, FC } from 'react'

import { isNotNil, useTranslation } from '../utils'

import { FormField, RadioGroup } from '../components'
import { useStore } from '../store'
import type { BlockProps } from './Block'
import { Block } from './Block'
import { Form } from './Form'

function getOpinionScaleStyle(optionSize?: number): CSSProperties | undefined {
  if (typeof optionSize !== 'number' || Number.isNaN(optionSize)) {
    return undefined
  }

  const desktopSize = Math.max(24, Math.min(96, Math.round(optionSize)))
  const mobileSize = Math.max(24, Math.round(desktopSize * 0.9))

  return {
    ['--neptunysform-opinion-option-size' as string]: `${desktopSize}px`,
    ['--neptunysform-opinion-option-size-mobile' as string]: `${mobileSize}px`
  }
}

export const OpinionScale: FC<BlockProps> = ({ field, ...restProps }) => {
  const { state } = useStore()
  const { t } = useTranslation()
  const isCentered = field.properties?.optionAlignment === 'center'
  const style = getOpinionScaleStyle(field.properties?.optionSize)

  const options = Array.from({ length: field.properties?.total || 10 }).map((_, index) => {
    const value = index + 1

    return {
      keyName: value === 10 ? '0' : `${value}`,
      label: `${value}`,
      value: value
    }
  })

  function getValues(values: any) {
    return values.input[0]
  }

  return (
    <Block
      className={`neptunysform-opinion-scale${isCentered ? ' neptunysform-options-center' : ''}`}
      field={field}
      style={style}
      {...restProps}
    >
      <Form
        initialValues={{
          input: [state.values[field.id]].filter(isNotNil)
        }}
        autoSubmit={true}
        autoSubmitDelayMs={420}
        isSubmitShow={false}
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
          <RadioGroup options={options} isHotkeyShow={false} selectionFeedback={true} />
        </FormField>

        <div className="neptunysform-opinion-scale-labels">
          <div className="flex-1 text-left">{field.properties?.leftLabel}</div>
          <div className="flex-1 text-center">{field.properties?.centerLabel}</div>
          <div className="flex-1 text-right">{field.properties?.rightLabel}</div>
        </div>
      </Form>
    </Block>
  )
}
