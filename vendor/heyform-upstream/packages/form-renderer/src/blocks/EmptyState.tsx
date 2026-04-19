import type { FormField } from '@heyform-inc/shared-types-enums'
import clsx from 'clsx'
import type { FC } from 'react'

import { useKey, useTranslation } from '../utils'

import { Submit } from '../components'
import { Block, BlockProps } from './Block'

interface EmptyStateProps extends Omit<BlockProps, 'field'> {
  field: Partial<FormField>
  onClick: () => void
}

export const EmptyState: FC<EmptyStateProps> = ({ className, field, onClick, ...restProps }) => {
  const { t } = useTranslation()

  useKey('Enter', onClick)

  return (
    <Block
      className={clsx(
        'heyform-empty-state',
        className,
        field.layout?.contentAlign && `heyform-welcome-align-${field.layout.contentAlign}`,
        field.layout?.titleSize && field.layout.titleSize !== 'normal' && `heyform-welcome-title-${field.layout.titleSize}`,
        typeof field.layout?.titleSizePx === 'number' && 'heyform-welcome-title-custom'
      )}
      style={{
        '--heyform-welcome-title-size-px':
          typeof field.layout?.titleSizePx === 'number' ? `${field.layout.titleSizePx}px` : undefined
      }}
      field={field as FormField}
      isScrollable={false}
      {...restProps}
    >
      <Submit
        className={field.properties?.buttonSubtext ? 'heyform-submit-with-helper' : undefined}
        text={field.properties?.buttonText || t('Next')}
        helper={
          field.properties?.buttonSubtext ? (
            <div className="heyform-block-description">{field.properties.buttonSubtext}</div>
          ) : undefined
        }
        onClick={onClick}
      />
    </Block>
  )
}
