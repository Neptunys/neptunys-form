import type { CSSProperties, FC } from 'react'

import { useTranslation } from '../utils'

import { FormField, Rate } from '../components'
import { RATING_SHAPE_ICONS } from '../consts'
import { useStore } from '../store'
import type { BlockProps } from './Block'
import { Block } from './Block'
import { Form } from './Form'

function getRatingStyle(optionSize?: number): CSSProperties | undefined {
  if (typeof optionSize !== 'number' || Number.isNaN(optionSize)) {
    return undefined
  }

  const desktopSize = Math.max(24, Math.min(96, Math.round(optionSize)))
  const mobileSize = Math.max(24, Math.round(desktopSize * 0.86))

  return {
    ['--heyform-rating-icon-size' as string]: `${desktopSize}px`,
    ['--heyform-rating-icon-size-mobile' as string]: `${mobileSize}px`
  }
}

function getShape(shape?: string) {
  let name = 'star'

  if (shape && Object.keys(RATING_SHAPE_ICONS).includes(shape)) {
    name = shape
  }

  return name
}

export const Rating: FC<BlockProps> = ({ field, ...restProps }) => {
  const { state } = useStore()
  const { t } = useTranslation()
  const shape = getShape(field.properties?.shape)
  const isCentered = field.properties?.optionAlignment === 'center'
  const style = getRatingStyle(field.properties?.optionSize)

  function getValues(values: any) {
    return values.input
  }

  function characterRender(index: number) {
    return (
      <>
        {RATING_SHAPE_ICONS[shape]}
        <span className="heyform-rate-index">{index}</span>
      </>
    )
  }

  return (
    <Block
      className={`heyform-rating${isCentered ? ' heyform-options-center' : ''}`}
      field={field}
      style={style}
      {...restProps}
    >
      <Form
        initialValues={{
          input: state.values[field.id]
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
          <Rate count={field.properties?.total || 5} itemRender={characterRender} />
        </FormField>
      </Form>
    </Block>
  )
}
