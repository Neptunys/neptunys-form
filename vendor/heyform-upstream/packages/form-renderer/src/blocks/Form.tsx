import { IconChevronLeft } from '@tabler/icons-react'
import type { FormField, FormSettings } from '@heyform-inc/shared-types-enums'
import { FieldKindEnum, NumberPrice } from '@heyform-inc/shared-types-enums'
import Big from 'big.js'
import clsx from 'clsx'
import type { FormProps as RCFormProps } from 'rc-field-form'
import RCForm, { Field, useForm } from 'rc-field-form'
import { FC, ReactNode, useEffect, useMemo, useRef, useState } from 'react'

import {
  getNavigateFieldId,
  sendMessageToParent,
  sliceFieldsByLogics,
  useEnterKey,
  useTranslation,
  validateLogicField
} from '../utils'
import { applyLogicToFields, validateFields } from '@heyform-inc/answer-utils'
import { clone, helper } from '@heyform-inc/utils'

import { Submit } from '../components'
import { removeStorage, useStore } from '../store'

function getLeadContactFieldIds(fields: FormField[], settings?: FormSettings) {
  const fieldIds = new Set<string>()

  if (helper.isValid(settings?.respondentEmailFieldId)) {
    fieldIds.add(settings!.respondentEmailFieldId!)
  } else {
    fields
      .filter(candidate => candidate.kind === FieldKindEnum.EMAIL)
      .forEach(candidate => fieldIds.add(candidate.id))
  }

  if (helper.isValid(settings?.respondentPhoneFieldId)) {
    fieldIds.add(settings!.respondentPhoneFieldId!)
  } else {
    fields
      .filter(candidate => candidate.kind === FieldKindEnum.PHONE_NUMBER)
      .forEach(candidate => fieldIds.add(candidate.id))
  }

  return Array.from(fieldIds)
}

function hasLeadContactValue(values: Record<string, any>, fields: FormField[], settings?: FormSettings) {
  return getLeadContactFieldIds(fields, settings).some(fieldId => helper.isValid(values[fieldId]))
}

interface FormProps extends RCFormProps {
  field: FormField
  autoSubmit?: boolean
  autoSubmitDelayMs?: number
  allowAutoSubmitWithNextButton?: boolean
  submitOnChangeWhen?: (value: any) => boolean
  isSubmitShow?: boolean
  hideSubmitIfErrorOccurred?: boolean
  getValues?: (values: any) => any
  children?: ReactNode
}

export const Form: FC<FormProps> = ({
  field,
  autoSubmit: rawAutoSubmit = false,
  autoSubmitDelayMs = 80,
  allowAutoSubmitWithNextButton = false,
  submitOnChangeWhen,
  isSubmitShow: rawSubmitShow = true,
  validateTrigger: trigger,
  hideSubmitIfErrorOccurred = false,
  getValues,
  children,
  ...restProps
}) => {
  const { onValuesChange: externalOnValuesChange, ...formProps } = restProps
  const [form] = useForm<any>()
  const { t } = useTranslation()
  const { state, dispatch } = useStore()
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string>()
  const autoSubmitTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const leadCaptureTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const lastLeadCaptureKeyRef = useRef<string>()

  const autoSubmit = useMemo(
    () => rawAutoSubmit && (allowAutoSubmitWithNextButton || !state.alwaysShowNextButton),
    [allowAutoSubmitWithNextButton, rawAutoSubmit, state.alwaysShowNextButton]
  )

  const validateTrigger = trigger ? trigger : autoSubmit ? 'onChange' : 'onSubmit'
  const isLastBlock = useMemo(
    () => state.scrollIndex! >= state.fields.length - 1,
    [state.fields.length, state.scrollIndex]
  )
  const actionText = useMemo(() => field.properties?.buttonText || 'OK', [field.properties?.buttonText])

  const initialValues = getValues ? getValues(restProps.initialValues) : restProps.initialValues
  const isSubmitShow = useMemo(
    () => rawSubmitShow || state.alwaysShowNextButton,
    [rawSubmitShow, state.alwaysShowNextButton]
  )
  const submitVisible = useMemo(
    () =>
      hideSubmitIfErrorOccurred && !isSubmitShow
        ? false
        : helper.isValid(initialValues) || isSubmitShow,
    [initialValues, isSubmitShow, hideSubmitIfErrorOccurred]
  )
  const showBackButton = useMemo(() => state.scrollIndex! > 0, [state.scrollIndex])

  const isSkippable = useMemo(() => {
    return !field.validations?.required && field.kind !== 'statement' && field.kind !== 'group'
  }, [])

  async function handleFinish(formValue: any) {
    const value = getValues ? getValues(formValue) : formValue

    if (helper.isValid(value)) {
      dispatch({
        type: 'setValues',
        payload: {
          values: {
            [field.id]: value
          }
        }
      })
    }

    const values = { ...state.values, [field.id]: value }
    const isTouched = validateLogicField(field, state.jumpFieldIds, values)
    const isPartialSubmission = state.isScrollNextDisabled && !isTouched

    if (isLastBlock || isPartialSubmission) {
      if (loading) {
        return
      }

      if (isLastBlock) {
        dispatch({
          type: 'setIsSubmitTouched',
          payload: {
            isSubmitTouched: true
          }
        })
      }

      setSubmitError(undefined)

      const fields = isPartialSubmission
        ? sliceFieldsByLogics(state.fields, state.jumpFieldIds)
        : state.fields

      try {
        validateFields(fields, values)
        setLoading(true)

        if (state.stripe) {
          const paymentField = state.fields.find(f => f.kind === FieldKindEnum.PAYMENT)

          if (paymentField) {
            const value = values[paymentField.id]

            if (helper.isValid(value)) {
              const price = paymentField.properties?.price as NumberPrice
              const currency = paymentField.properties?.currency

              if (!helper.isValid(price?.value) || price.value <= 0 || !helper.isValid(currency)) {
                values[paymentField.id] = undefined
              } else {
                values[paymentField.id] = {
                  amount: Big(price.value).times(100).toNumber(),
                  currency,
                  billingDetails: {
                    name: value.name
                  }
                }
              }
            }
          }
        }

        // Submit form
        await state.onSubmit?.(values, isPartialSubmission, state.stripe)

        if (helper.isTrue(state.query.hideAfterSubmit)) {
          sendMessageToParent('HIDE_EMBED_MODAL')
        }

        setLoading(false)

        const { variables } = applyLogicToFields(
          clone([...state.allFields, ...state.thankYouFields].filter(Boolean) as FormField[]),
          state.logics,
          state.parameters,
          values
        )

        const thankYouFieldId = getNavigateFieldId(
          field,
          state.thankYouFields,
          state.logics,
          state.parameters,
          values,
          variables
        )

        dispatch({
          type: 'setIsSubmitted',
          payload: {
            isSubmitted: true,
            thankYouFieldId: thankYouFieldId || state.thankYouFields[0]?.id
          }
        })

        // Clear storage cache
        removeStorage(state.formId)
      } catch (err: any) {
        console.error(err, err?.response)
        setLoading(false)

        if (helper.isValid(err?.response?.id)) {
          dispatch({
            type: 'scrollToField',
            payload: {
              fieldId: err?.response?.id,
              errorFieldId: err?.response?.id
            }
          })
        } else {
          setSubmitError(err?.message)
        }
      }

      return
    }

    if (state.isSubmitTouched) {
      try {
        validateFields(state.fields, values)
      } catch (err: any) {
        console.error(err, err?.response)
        dispatch({
          type: 'scrollToField',
          payload: {
            fieldId: err.response?.id,
            errorFieldId: err?.response?.id
          }
        })

        return
      }
    }

    // Navigate to next form field
    dispatch({ type: 'scrollNext' })
  }

  function handleValuesChange(changes: any, values: any) {
    externalOnValuesChange?.(changes, values)

    const nextFormValues = {
      ...values,
      ...changes
    }
    const nextValue = getValues ? getValues(nextFormValues) : nextFormValues
    const shouldSubmitOnChange =
      helper.isValid(nextValue) && (autoSubmit || submitOnChangeWhen?.(nextValue) === true)
    const nextLeadValues = {
      ...state.values,
      [field.id]: nextValue
    }

    if (state.onLeadCapture && hasLeadContactValue(nextLeadValues, state.allFields, state.settings)) {
      const leadCaptureKey = JSON.stringify({
        fieldId: field.id,
        value: nextLeadValues[field.id]
      })

      try {
        validateFields([field], {
          [field.id]: nextValue
        })

        if (leadCaptureKey !== lastLeadCaptureKeyRef.current) {
          if (leadCaptureTimeoutRef.current) {
            clearTimeout(leadCaptureTimeoutRef.current)
          }

          leadCaptureTimeoutRef.current = setTimeout(() => {
            lastLeadCaptureKeyRef.current = leadCaptureKey
            void Promise.resolve(state.onLeadCapture?.(nextLeadValues, field)).catch(console.error)
          }, 320)
        }
      } catch {
        // Ignore invalid intermediate values while the respondent is still typing.
      }
    }

    if (shouldSubmitOnChange) {
      if (autoSubmitTimeoutRef.current) {
        clearTimeout(autoSubmitTimeoutRef.current)
        autoSubmitTimeoutRef.current = undefined
      }

      form.setFieldsValue(nextFormValues)

      if (isLastBlock) {
        dispatch({
          type: 'setValues',
          payload: {
            values: {
              [field.id]: nextValue
            }
          }
        })
      }

      autoSubmitTimeoutRef.current = setTimeout(() => {
        form.submit()
      }, autoSubmitDelayMs)

      return
    }

    // Rc-field-form doesn't provide any way to clear errors,
    // so it can only be done in the following disgraceful way.
    // see https://github.com/ant-design/ant-design/issues/24599#issuecomment-653292811
    Object.keys(values).forEach(name => {
      const error = form.getFieldError(name)

      if (error.length > 0) {
        form.setFields([
          {
            name,
            errors: []
          }
        ])
      }
    })
  }

  function handleSkip() {
    dispatch({ type: 'scrollNext' })
  }

  function handlePrevious() {
    dispatch({ type: 'scrollPrevious' })
  }

  useEnterKey(`heyform-${state.instanceId}-${field.id}`, (event: KeyboardEvent) => {
    if (window.heyform.device.mobile) {
      return event.preventDefault()
    }

    form.submit()
  })

  useEffect(() => {
    if (field.id === state.errorFieldId) {
      form.validateFields()
    }
  }, [state.errorFieldId])

  useEffect(() => {
    return () => {
      if (autoSubmitTimeoutRef.current) {
        clearTimeout(autoSubmitTimeoutRef.current)
      }

      if (leadCaptureTimeoutRef.current) {
        clearTimeout(leadCaptureTimeoutRef.current)
      }
    }
  }, [])

  return (
    <RCForm
      className={clsx('heyform-form', 'heyform-form-mobile-docked', {
        'heyform-form-last': isLastBlock
      })}
      autoComplete="off"
      form={form}
      validateTrigger={validateTrigger}
      onValuesChange={handleValuesChange}
      onFinish={handleFinish}
      {...formProps}
    >
      <div className="heyform-form-content">{children}</div>

      {/* Submit */}
      {isLastBlock || state.isScrollNextDisabled ? (
        <>
          {submitError && (
            <div className="heyform-validation-wrapper">
              <div className="heyform-validation-error">{submitError}</div>
            </div>
          )}
          <div className="heyform-form-actions">
            {showBackButton && (
              <button
                className="heyform-back-button"
                type="button"
                aria-label={t('paginationPrevious')}
                onClick={handlePrevious}
              >
                <IconChevronLeft className="heyform-back-button-icon" />
                <span className="heyform-back-button-text">{t('paginationPrevious')}</span>
              </button>
            )}
            <Field shouldUpdate={true}>
              <Submit className="!mt-0" text={actionText} loading={loading} />
            </Field>
          </div>
        </>
      ) : (
        <div className="heyform-form-actions">
          {showBackButton && (
            <button
              className="heyform-back-button"
              type="button"
              aria-label={t('paginationPrevious')}
              onClick={handlePrevious}
            >
              <IconChevronLeft className="heyform-back-button-icon" />
              <span className="heyform-back-button-text">{t('paginationPrevious')}</span>
            </button>
          )}
          {submitVisible && (
            <Field shouldUpdate={true}>
              {state.alwaysShowNextButton ? (
                <Submit className="!mt-0" text={actionText} />
              ) : (
                (_, __, { getFieldsError }) => {
                  const hasError = getFieldsError().some(({ errors }) => errors.length)

                  return (
                    <Submit className="!mt-0" text={actionText} disabled={hasError} />
                  )
                }
              )}
            </Field>
          )}
          {isSkippable && (
            <button className="heyform-skip-button" type="button" onClick={handleSkip}>
              {t('Skip')}
            </button>
          )}
        </div>
      )}
    </RCForm>
  )
}
