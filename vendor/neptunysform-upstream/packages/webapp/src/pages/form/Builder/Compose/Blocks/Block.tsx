import { FieldLayoutAlignEnum, QUESTION_FIELD_KINDS } from '@neptunysform-inc/shared-types-enums'
import type { FC } from 'react'
import { RefObject, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { cn, isRenderableImageSource } from '@/utils'
import { helper } from '@neptunysform-inc/utils'

import { useFormStore } from '@/store'
import { FormFieldType } from '@/types'

import { RichText } from '../../RichText'
import { useStoreContext } from '../../store'
import { Layout } from '../Layout'

export interface BlockProps extends ComponentProps {
  field: FormFieldType
  locale: string
  parentField?: FormFieldType
}

export const Block: FC<BlockProps> = ({
  className,
  field,
  locale: _locale,
  parentField,
  children,
  ...restProps
}) => {
  const { dispatch } = useStoreContext()
  const { tempSettings } = useFormStore()
  const { t } = useTranslation()

  const titleRef = useRef<HTMLDivElement>(undefined)
  const descriptionRef = useRef<HTMLDivElement>(undefined)

  const isCoverShow = helper.isValid(field.layout?.mediaUrl)
  const isImageCover = isRenderableImageSource(field.layout?.mediaUrl)
  const inlineMediaPosition = field.layout?.inlineMediaPosition === 'top' ? 'top' : 'bottom'
  const inlineMediaWidth = helper.isValid(field.layout?.inlineMediaWidth)
    ? Math.max(20, Math.min(100, Number(field.layout?.inlineMediaWidth)))
    : 75
  const showQuestionNumber = tempSettings?.enableQuestionNumbers !== false
  const stepLabel =
    QUESTION_FIELD_KINDS.includes(field.kind) && helper.isValid(field.index)
      ? String(field.index)
      : undefined
  const inlineImage =
    isCoverShow && field.layout?.align === FieldLayoutAlignEnum.INLINE ? (
      <div className="neptunysform-block-image" style={{ maxWidth: '100%', width: `${inlineMediaWidth}%` }}>
        {isImageCover ? (
          <img src={field.layout?.mediaUrl} />
        ) : (
          <div
            style={{
              backgroundImage: field.layout?.mediaUrl
            }}
          ></div>
        )}
      </div>
    ) : null

  function handleTitleChange(title: string) {
    dispatch({
      type: 'updateField',
      payload: {
        id: field.id,
        updates: {
          title
        }
      }
    })
  }

  function handleDescriptionChange(description: string) {
    dispatch({
      type: 'updateField',
      payload: {
        id: field.id,
        updates: {
          description
        }
      }
    })
  }

  const handleTitleChangeCallback = useCallback(handleTitleChange, [field.id])
  const handleDescriptionChangeCallback = useCallback(handleDescriptionChange, [field.id])

  useEffect(() => {
    if (titleRef.current) {
      titleRef.current!.innerHTML = (field.title as string) || ''
    }

    if (descriptionRef.current) {
      descriptionRef.current!.innerHTML = (field.description as string) || ''
    }
  }, [field.id])

  return (
    <>
      <div className="neptunysform-theme-background" />

      {field.layout?.align !== FieldLayoutAlignEnum.INLINE && (
        <Layout className={`neptunysform-layout-${field.layout?.align}`} layout={field.layout} />
      )}

      {parentField && (
        <div className="neptunysform-block-group rounded-t-lg">
          <div className="neptunysform-block-group-container">
            <div className="neptunysform-block-title">{parentField.title}</div>
          </div>
        </div>
      )}

      <div
        className={cn('neptunysform-block-container', {
          [`neptunysform-block-${field.layout?.align}`]: field.layout?.align
        })}
      >
        <div className="flex min-h-full flex-col items-center justify-center">
          <div className={cn('neptunysform-block', className)} {...restProps}>
            {inlineMediaPosition === 'top' && inlineImage}

            <div className="mb-10">
              <div className="neptunysform-block-title-row">
                {showQuestionNumber && stepLabel && (
                  <span className="neptunysform-question-index">{stepLabel}</span>
                )}
                <RichText
                  className="neptunysform-block-title"
                  innerRef={titleRef as RefObject<HTMLDivElement>}
                  placeholder={t('form.builder.compose.question')}
                  onChange={handleTitleChangeCallback}
                />
              </div>
              <RichText
                className="neptunysform-block-description"
                innerRef={descriptionRef as RefObject<HTMLDivElement>}
                placeholder={t('form.builder.compose.description')}
                onChange={handleDescriptionChangeCallback}
              />
            </div>

            {inlineMediaPosition === 'bottom' && inlineImage}

            {children}
          </div>
        </div>
      </div>
    </>
  )
}
