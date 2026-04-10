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

const RadiusControl: FC<RadiusControlProps> = ({ value = 6, onChange }) => {
  return (
    <div className="flex items-center gap-3">
      <div className="text-secondary min-w-10 text-right text-sm/6">{value}px</div>
      <Slider className="flex-1" min={0} max={32} step={1} value={value} onChange={onChange} />
    </div>
  )
}

const LogoSizeControl: FC<RadiusControlProps> = ({ value = 40, onChange }) => {
  return (
    <div className="flex items-center gap-3">
      <div className="text-secondary min-w-10 text-right text-sm/6">{value}px</div>
      <Slider className="flex-1" min={16} max={96} step={1} value={value} onChange={onChange} />
    </div>
  )
}

export default function Customize() {
  const { t } = useTranslation()

  const { formId } = useParam()
  const toast = useToast()
  const [rcForm] = useRCForm()
  const { form, themeSettings, updateForm, updateThemeSettings, revertThemeSettings } = useFormStore()

  const { loading, run } = useRequest(
    async (values: any) => {
      const { logo, ...theme } = values

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
        const { logo, ...theme } = values as FormTheme & { logo?: string }

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
        ...form?.themeSettings?.theme
      })
      rcForm.resetFields()
    })
  }

  function handleValuesChange(_: AnyMap, values: FormTheme & { logo?: string }) {
    const { logo, ...theme } = values

    if (
      helper.isEmpty(theme.backgroundImage) &&
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
          ...themeSettings?.theme
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
        </div>

        <div className="border-accent-light border-t pt-4">
          <Form.Item
            name="backgroundImage"
            className="[&_[data-slot=content]]:flex-none [&_[data-slot=control]]:flex [&_[data-slot=control]]:items-center [&_[data-slot=control]]:justify-between"
            label={t('form.builder.design.customize.backgroundImage')}
          >
            <BackgroundImage />
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

        {(helper.isValid(themeSettings?.theme?.backgroundImage) ||
          helper.isValid(themeSettings?.theme?.desktopBackgroundImage) ||
          helper.isValid(themeSettings?.theme?.mobileBackgroundImage)) && (
          <div className="border-accent-light border-t pt-4">
            <Form.Item name="backgroundBrightness">
              <ImageBrightness
                imageURL={
                  themeSettings?.theme?.desktopBackgroundImage ||
                  themeSettings?.theme?.mobileBackgroundImage ||
                  themeSettings?.theme?.backgroundImage
                }
              />
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
