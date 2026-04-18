import { FieldKindEnum, FieldLayoutAlignEnum } from '@heyform-inc/shared-types-enums'
import { startTransition, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { cn, isRenderableImageSource } from '@/utils'

import { Button, ImagePicker, Select, Slider } from '@/components'
import { LAYOUT_OPTIONS } from '@/consts'

import { useStoreContext } from '../../store'
import ImageBrightness from './ImageBrightness'

export default function CoverAndLayout() {
  const { t } = useTranslation()
  const { state, dispatch } = useStoreContext()
  const field = state.currentField!
  const showInlineMediaControls =
    isRenderableImageSource(field.layout?.mediaUrl) &&
    field.layout?.align === FieldLayoutAlignEnum.INLINE &&
    [FieldKindEnum.STATEMENT, FieldKindEnum.WELCOME, FieldKindEnum.THANK_YOU].includes(field.kind)

  const isWelcome = field.kind === FieldKindEnum.WELCOME

  const getLegacyTitleSizePx = (size?: string) => {
    switch (size) {
      case 'large':
        return 64
      case 'xl':
        return 76
      default:
        return 52
    }
  }

  const handleChange = useCallback(
    (key: string, value: any) => {
      startTransition(() => {
        let layout = field.layout

        if (key === 'mediaUrl') {
          layout = {
            ...layout,
            mediaType: 'image',
            brightness: field.layout?.brightness ?? 0,
            align: field.layout?.align || FieldLayoutAlignEnum.INLINE,
            inlineMediaPosition: field.layout?.inlineMediaPosition || 'bottom',
            inlineMediaWidth: field.layout?.inlineMediaWidth || 75
          }
        }

        if (key === 'titleSizePx') {
          layout = {
            ...layout,
            titleSize: undefined
          }
        }

        if (key === 'contentAlignPx') {
          layout = {
            ...layout,
            contentAlign: undefined
          }
        }

        const currentValue = (layout as Record<string, any> | undefined)?.[key]

        if (currentValue === value) {
          return
        }

        dispatch({
          type: 'updateField',
          payload: {
            id: field.id,
            updates: {
              layout: {
                ...layout,
                [key]: value
              }
            }
          }
        })
      })
    },
    [dispatch, field]
  )

  function handleRemove() {
    dispatch({
      type: 'updateField',
      payload: {
        id: field.id,
        updates: {
          layout: {}
        }
      }
    })
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <label className="text-sm/6" htmlFor="#">
          {t('components.imagePicker.image')}
        </label>

        <div className="flex items-center gap-2">
          <ImagePicker
            tabs={['image', 'unsplash']}
            onChange={value => handleChange('mediaUrl', value)}
          >
            <Button.Ghost size="sm">
              {t(isRenderableImageSource(field.layout?.mediaUrl) ? 'components.change' : 'components.add')}
            </Button.Ghost>
          </ImagePicker>

          {isRenderableImageSource(field.layout?.mediaUrl) && (
            <Button.Ghost size="sm" onClick={handleRemove}>
              {t('components.remove')}
            </Button.Ghost>
          )}
        </div>
      </div>

      {isRenderableImageSource(field.layout?.mediaUrl) && (
        <>
          {field.layout?.align !== FieldLayoutAlignEnum.INLINE && (
            <div className="border-accent-light mt-4 border-t pt-4">
              <ImageBrightness
                imageURL={field.layout?.mediaUrl}
                value={field.layout?.brightness}
                onChange={value => handleChange('brightness', value)}
              />
            </div>
          )}

          <div className="border-accent-light mt-4 space-y-1 border-t pt-4">
            <label className="text-sm/6" htmlFor="#">
              {t('form.builder.settings.layout')}
            </label>

            <div className="grid grid-cols-3 gap-3">
              {LAYOUT_OPTIONS.map(row => (
                <div
                  key={row.value}
                  className={cn(
                    'border-input text-secondary hover:border-primary hover:text-primary cursor-pointer rounded-lg border ring-1 ring-transparent',
                    {
                      'border-primary text-primary ring-input': field.layout?.align === row.value
                    }
                  )}
                  onClick={() => handleChange('align', row.value)}
                >
                  <row.icon className="h-auto w-full" />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {showInlineMediaControls && (
        <div className="border-accent-light mt-4 space-y-3 border-t pt-4">
          <div className="space-y-1">
            <label className="text-sm/6" htmlFor="#">
              {t('form.builder.settings.inlineImage.position')}
            </label>

            <Select
              className="w-full"
              options={[
                {
                  label: t('form.builder.settings.inlineImage.belowText'),
                  value: 'bottom'
                },
                {
                  label: t('form.builder.settings.inlineImage.aboveText'),
                  value: 'top'
                }
              ]}
              value={field.layout?.inlineMediaPosition || 'bottom'}
              onChange={value => handleChange('inlineMediaPosition', value)}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm/6" htmlFor="#">
                {t('form.builder.settings.inlineImage.size')}
              </label>

              <span className="text-secondary text-xs/6">
                {field.layout?.inlineMediaWidth || 75}%
              </span>
            </div>

            <Slider
              min={3}
              max={100}
              value={field.layout?.inlineMediaWidth || 75}
              onChange={value => handleChange('inlineMediaWidth', value)}
            />
          </div>
        </div>
      )}

      {isWelcome && (
        <div className="border-accent-light mt-4 space-y-3 border-t pt-4">
          <div className="space-y-1">
            <label className="text-sm/6" htmlFor="#">
              Content alignment
            </label>

            <Select
              className="w-full"
              options={[
                {
                  label: 'Left',
                  value: 'left'
                },
                {
                  label: 'Center',
                  value: 'center'
                },
                {
                  label: 'Right',
                  value: 'right'
                }
              ]}
              value={field.layout?.contentAlign || 'center'}
              onChange={value => handleChange('contentAlign', value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm/6" htmlFor="#">
              Content alignment (px)
            </label>
            <div className="flex items-center justify-between gap-3">
              <span className="text-secondary text-xs/6">-320px</span>
              <span className="text-secondary text-xs/6">{field.layout?.contentAlignPx ?? 0}px</span>
              <span className="text-secondary text-xs/6">320px</span>
            </div>
            <Slider
              min={-320}
              max={320}
              value={field.layout?.contentAlignPx ?? 0}
              onChange={value => handleChange('contentAlignPx', value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm/6" htmlFor="#">
              Title size (px)
            </label>
            <div className="flex items-center justify-between gap-3">
              <span className="text-secondary text-xs/6">24px</span>
              <span className="text-secondary text-xs/6">
                {field.layout?.titleSizePx ?? getLegacyTitleSizePx(field.layout?.titleSize)}px
              </span>
              <span className="text-secondary text-xs/6">120px</span>
            </div>
            <Slider
              min={24}
              max={120}
              value={field.layout?.titleSizePx ?? getLegacyTitleSizePx(field.layout?.titleSize)}
              onChange={value => handleChange('titleSizePx', value)}
            />
          </div>
        </div>
      )}
    </>
  )
}
