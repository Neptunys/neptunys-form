import { GOOGLE_FONTS, SYSTEM_FONTS, insertWebFont } from '@heyform-inc/form-renderer'
import { FormTheme } from '@heyform-inc/shared-types-enums'
import { useRequest } from 'ahooks'
import { useForm as useRCForm } from 'rc-field-form'
import { FC, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { FormService } from '@/services'
import { isRenderableImageSource, nextTick, useParam } from '@/utils'
import { helper } from '@heyform-inc/utils'

import {
  Button,
  ColorPicker,
  Form,
  ImageFormPicker,
  ImagePicker,
  Input,
  Select,
  Slider,
  useToast
} from '@/components'
import { useFormStore } from '@/store'

import ImageBrightness, { ImageBrightnessProps } from '../Question/ImageBrightness'

function normalizeThemeValues(theme?: FormTheme): FormTheme {
  const nextTheme = {
    ...theme
  }
  const hasResponsiveBackgrounds =
    helper.isValid(nextTheme.desktopBackgroundImage) || helper.isValid(nextTheme.mobileBackgroundImage)

  if (!hasResponsiveBackgrounds && helper.isValid(nextTheme.backgroundImage)) {
    nextTheme.desktopBackgroundImage = nextTheme.backgroundImage
    nextTheme.mobileBackgroundImage = nextTheme.backgroundImage
  }

  nextTheme.backgroundImage = undefined

  return nextTheme
}

function getBackgroundPreviewImage(theme?: FormTheme) {
  if (!theme) {
    return undefined
  }

  return theme.desktopBackgroundImage || theme.mobileBackgroundImage
}

export const BackgroundImage: FC<Pick<ImageBrightnessProps, 'value' | 'onChange'>> = ({
  value,
  onChange
}) => {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-2">
      <ImagePicker tabs={['image', 'gradient', 'unsplash']} onChange={onChange}>
        <Button.Ghost size="sm">
          {t(helper.isValid(value) ? 'components.change' : 'components.add')}
        </Button.Ghost>
      </ImagePicker>

      {helper.isValid(value) && (
        <Button.Ghost size="sm" onClick={() => onChange?.(undefined)}>
          {t('components.remove')}
        </Button.Ghost>
      )}
    </div>
  )
}

interface RadiusControlProps {
  value?: number
  onChange?: (value?: number) => void
}

interface SliderControlProps extends RadiusControlProps {
  min: number
  max: number
  step?: number
  fallbackValue: number
  allowReset?: boolean
}

const SliderControl: FC<SliderControlProps> = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  fallbackValue,
  allowReset = false
}) => {
  const hasValue = helper.isNumber(value)

  return (
    <div className="flex items-center gap-3">
      <div className="text-secondary min-w-14 text-right text-sm/6">
        {hasValue ? `${value}px` : 'Auto'}
      </div>
      <Slider
        className="flex-1"
        min={min}
        max={max}
        step={step}
        value={hasValue ? value : fallbackValue}
        onChange={onChange}
      />
      {allowReset && (
        <Button.Ghost size="sm" onClick={() => onChange?.(undefined)}>
          Auto
        </Button.Ghost>
      )}
    </div>
  )
}

const RadiusControl: FC<RadiusControlProps> = ({ value = 6, onChange }) => {
  return <SliderControl min={0} max={32} fallbackValue={6} value={value} onChange={onChange} />
}

const LogoSizeControl: FC<RadiusControlProps> = ({ value = 40, onChange }) => {
  return <SliderControl min={16} max={96} fallbackValue={40} value={value} onChange={onChange} />
}

export default function Customize() {
  const { t } = useTranslation()

  const { formId } = useParam()
  const toast = useToast()
  const [rcForm] = useRCForm()
  const { form, themeSettings, updateForm, updateThemeSettings, revertThemeSettings } = useFormStore()
  const normalizedTheme = useMemo(
    () => normalizeThemeValues(themeSettings?.theme),
    [themeSettings?.theme]
  )

  const { loading, run } = useRequest(
    async (values: any) => {
      const { logo, ...rawTheme } = values
      const theme = normalizeThemeValues(rawTheme)

      await FormService.updateTheme({
        formId,
        theme,
        logo
      })
    },
    {
      refreshDeps: [formId],
      manual: true,
      onSuccess: (_data, values) => {
        const { logo, ...rawTheme } = values as FormTheme & { logo?: string }
        const theme = normalizeThemeValues(rawTheme)

        updateForm({
          themeSettings: {
            logo,
            theme
          }
        })

        toast({
          title: t('form.builder.design.theme.success')
        })
      },
      onError: (err: any) => {
        console.error(err)

        toast({
          title: t('form.builder.design.theme.failed'),
          message: err.message
        })
      }
    }
  )

  const options = useMemo(
    () => [
      {
        value: SYSTEM_FONTS,
        label: (
          <span
            style={{
              fontFamily: SYSTEM_FONTS
            }}
          >
            {t('form.builder.design.customize.systemFonts')}
          </span>
        )
      },
      ...GOOGLE_FONTS.map(value => ({
        value,
        label: (
          <span
            style={{
              fontFamily: value
            }}
          >
            {value}
          </span>
        )
      }))
    ],
    [t]
  )

  function handleRevert() {
    revertThemeSettings()

    nextTick(() => {
      rcForm.setFieldsValue({
        logo: form?.themeSettings?.logo,
        ...normalizeThemeValues(form?.themeSettings?.theme)
      })
      rcForm.resetFields()
    })
  }

  function handleValuesChange(_: AnyMap, values: FormTheme & { logo?: string }) {
    const { logo, ...rawTheme } = values
    const theme = normalizeThemeValues(rawTheme)

    if (
      helper.isEmpty(theme.desktopBackgroundImage) &&
      helper.isEmpty(theme.mobileBackgroundImage)
    ) {
      theme.backgroundBrightness = 0

      nextTick(() => {
        rcForm.setFieldValue('backgroundBrightness', 0)
      })
    }

    updateThemeSettings({
      logo,
      theme
    })
  }

  useEffect(() => {
    insertWebFont(GOOGLE_FONTS)
  }, [])

  return (
    <>
      <Form
        form={rcForm}
        initialValues={{
          logo: themeSettings?.logo,
          ...normalizedTheme
        }}
        className="space-y-4 p-4"
        onValuesChange={handleValuesChange}
        onFinish={run}
      >
        <div>
          <div className="text-sm/6 font-semibold">{t('settings.branding.logo.title')}</div>
          <Form.Item
            className="mt-2"
            name="logo"
            rules={[
              {
                validator: async (_rule: any, value: string) => {
                  if (!value || isRenderableImageSource(value)) {
                    return
                  }

                  throw new Error(t('settings.branding.logo.invalid'))
                }
              }
            ]}
          >
            <ImageFormPicker
              className="[&_[data-slot=avatar]]:h-8 [&_[data-slot=avatar]]:w-auto [&_[data-slot=avatar]]:after:hidden [&_[data-slot=avatar]_img]:aspect-auto [&_[data-slot=avatar]_img]:w-auto [&_[data-slot=avatar]_img]:rounded-none"
              resize={{
                height: 100
              }}
            />
          </Form.Item>

          <Form.Item
            className="mt-3 [&_[data-slot=content]]:flex-none [&_[data-slot=control]]:block"
            name="logoSize"
            label="Logo size"
          >
            <LogoSizeControl />
          </Form.Item>
        </div>

        <Form.Item name="fontFamily">
          <Select
            className="w-full"
            options={options}
            contentProps={{
              position: 'popper'
            }}
          />
        </Form.Item>

        <div className="space-y-4">
          <Form.Item
            name="questionTextColor"
            className="[&_[data-slot=content]]:flex-none [&_[data-slot=control]]:flex [&_[data-slot=control]]:items-center [&_[data-slot=control]]:justify-between"
            label={t('form.builder.design.customize.question')}
          >
            <ColorPicker
              contentProps={{
                side: 'bottom',
                align: 'end'
              }}
            />
          </Form.Item>

          <Form.Item
            name="answerTextColor"
            className="[&_[data-slot=content]]:flex-none [&_[data-slot=control]]:flex [&_[data-slot=control]]:items-center [&_[data-slot=control]]:justify-between"
            label={t('form.builder.design.customize.answer')}
          >
            <ColorPicker
              contentProps={{
                side: 'bottom',
                align: 'end'
              }}
            />
          </Form.Item>

          <Form.Item
            name="buttonBackground"
            className="[&_[data-slot=content]]:flex-none [&_[data-slot=control]]:flex [&_[data-slot=control]]:items-center [&_[data-slot=control]]:justify-between"
            label={t('form.builder.design.customize.buttons')}
          >
            <ColorPicker
              contentProps={{
                side: 'bottom',
                align: 'end'
              }}
            />
          </Form.Item>

          <Form.Item
            name="buttonTextColor"
            className="[&_[data-slot=content]]:flex-none [&_[data-slot=control]]:flex [&_[data-slot=control]]:items-center [&_[data-slot=control]]:justify-between"
            label={t('form.builder.design.customize.buttonText')}
          >
            <ColorPicker
              contentProps={{
                side: 'bottom',
                align: 'end'
              }}
            />
          </Form.Item>

          <Form.Item
            name="progressColor"
            className="[&_[data-slot=content]]:flex-none [&_[data-slot=control]]:flex [&_[data-slot=control]]:items-center [&_[data-slot=control]]:justify-between"
            label="Progress color"
          >
            <ColorPicker
              contentProps={{
                side: 'bottom',
                align: 'end'
              }}
            />
          </Form.Item>

          <Form.Item
            name="progressTrackColor"
            className="[&_[data-slot=content]]:flex-none [&_[data-slot=control]]:flex [&_[data-slot=control]]:items-center [&_[data-slot=control]]:justify-between"
            label="Progress track"
          >
            <ColorPicker
              contentProps={{
                side: 'bottom',
                align: 'end'
              }}
            />
          </Form.Item>

          <Form.Item
            name="answerBorderRadius"
            className="[&_[data-slot=content]]:flex-none [&_[data-slot=control]]:block"
            label="Answer radius"
          >
            <RadiusControl />
          </Form.Item>

          <Form.Item
            name="buttonBorderRadius"
            className="[&_[data-slot=content]]:flex-none [&_[data-slot=control]]:block"
            label="Button radius"
          >
            <RadiusControl />
          </Form.Item>

          <Form.Item
            name="backgroundColor"
            className="[&_[data-slot=content]]:flex-none [&_[data-slot=control]]:flex [&_[data-slot=control]]:items-center [&_[data-slot=control]]:justify-between"
            label={t('form.builder.design.customize.background')}
          >
            <ColorPicker
              contentProps={{
                side: 'bottom',
                align: 'end'
              }}
            />
          </Form.Item>

          <Form.Item
            name="desktopAnswerWidth"
            className="[&_[data-slot=content]]:flex-none [&_[data-slot=control]]:block"
            label="Desktop answer width"
          >
            <SliderControl min={240} max={960} fallbackValue={496} allowReset />
          </Form.Item>

          <Form.Item
            name="mobileAnswerWidth"
            className="[&_[data-slot=content]]:flex-none [&_[data-slot=control]]:block"
            label="Mobile answer width"
          >
            <SliderControl min={160} max={640} fallbackValue={320} allowReset />
          </Form.Item>

          <Form.Item
            name="desktopAnswerGap"
            className="[&_[data-slot=content]]:flex-none [&_[data-slot=control]]:block"
            label="Desktop answer gap"
          >
            <SliderControl min={0} max={48} fallbackValue={12} allowReset />
          </Form.Item>

          <Form.Item
            name="mobileAnswerGap"
            className="[&_[data-slot=content]]:flex-none [&_[data-slot=control]]:block"
            label="Mobile answer gap"
          >
            <SliderControl min={0} max={32} fallbackValue={10} allowReset />
          </Form.Item>
        </div>

        <div className="border-accent-light border-t pt-4 space-y-4">
          <Form.Item
            name="desktopBackgroundImage"
            className="[&_[data-slot=content]]:flex-none [&_[data-slot=control]]:flex [&_[data-slot=control]]:items-center [&_[data-slot=control]]:justify-between"
            label="Desktop background image"
          >
            <BackgroundImage />
          </Form.Item>

          <Form.Item
            name="mobileBackgroundImage"
            className="[&_[data-slot=content]]:flex-none [&_[data-slot=control]]:flex [&_[data-slot=control]]:items-center [&_[data-slot=control]]:justify-between"
            label="Mobile background image"
          >
            <BackgroundImage />
          </Form.Item>
        </div>

        {helper.isValid(getBackgroundPreviewImage(normalizedTheme)) && (
          <div className="border-accent-light border-t pt-4">
            <Form.Item name="backgroundBrightness">
              <ImageBrightness imageURL={getBackgroundPreviewImage(normalizedTheme)} />
            </Form.Item>
          </div>
        )}

        <div className="border-accent-light border-t pt-4">
          <Form.Item
            name="customCSS"
            label={
              <div className="flex items-center justify-between">
                <span>{t('form.builder.design.customize.customCSS')}</span>
              </div>
            }
          >
            <Input.TextArea className="mt-2" rows={4} />
          </Form.Item>
        </div>

        <div className="border-accent-light bg-foreground sticky bottom-4 flex items-center gap-x-4 border-t pt-4">
          <Button.Ghost size="md" onClick={handleRevert}>
            {t('components.revert')}
          </Button.Ghost>
          <Button type="submit" size="md" className="flex-1" loading={loading}>
            {t('components.saveChanges')}
          </Button>
        </div>
      </Form>
    </>
  )
}
