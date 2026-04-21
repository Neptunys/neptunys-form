import type { FormField } from '@neptunysform-inc/shared-types-enums'
import clsx from 'clsx'
import type { CSSProperties, FC } from 'react'

import { useKey, useTranslation } from '../utils'

import { Submit } from '../components'
import { Block, BlockProps } from './Block'

interface EmptyStateProps extends Omit<BlockProps, 'field'> {
  field: Partial<FormField>
  onClick: () => void
}

export const EmptyState: FC<EmptyStateProps> = ({ className, field, onClick, ...restProps }) => {
  const { t } = useTranslation()
  const buttonSubtext = field.properties?.buttonSubtext
  const hasDescription = typeof buttonSubtext === 'string' && buttonSubtext.trim().length > 0

  useKey('Enter', onClick)

  return (
    <Block
      className={clsx(
        'neptunysform-empty-state',
        className,
        field.layout?.contentAlign && `neptunysform-welcome-align-${field.layout.contentAlign}`,
        field.layout?.titleSize && field.layout.titleSize !== 'normal' && `neptunysform-welcome-title-${field.layout.titleSize}`,
        typeof field.layout?.titleSizePx === 'number' && 'neptunysform-welcome-title-custom'
      )}
      style={{
        '--neptunysform-welcome-title-size-px':
          typeof field.layout?.titleSizePx === 'number' ? `${field.layout.titleSizePx}px` : undefined
      } as CSSProperties}
      field={field as FormField}
      isScrollable={false}
      {...restProps}
    >
      <Submit
        className={hasDescription ? 'neptunysform-submit-with-helper' : undefined}
        text={field.properties?.buttonText || t('Next')}
        helper={
          hasDescription ? (
            <div
              className="neptunysform-block-description"
              dangerouslySetInnerHTML={{ __html: buttonSubtext as string }}
            />
          ) : undefined
        }
        onClick={onClick}
      />
    </Block>
  )
}
