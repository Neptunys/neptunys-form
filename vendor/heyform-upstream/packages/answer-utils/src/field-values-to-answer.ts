import { Answer, CHOICES_FIELD_KINDS, FieldKindEnum, FormField } from '@heyform-inc/shared-types-enums'

import { helper } from '@heyform-inc/utils'

import { fieldsToValidateRules } from './fields-to-validate-rules'
import { normalizePhoneNumber } from './helper'
import { validate } from './validate'

function normalizeAnswerValue(rule: any, value: any) {
  if (rule.kind === FieldKindEnum.PHONE_NUMBER) {
    return normalizePhoneNumber(value, rule.properties?.defaultCountryCode) || value
  }

  if (rule.kind === FieldKindEnum.CONTACT_INFO && helper.isObject(value) && helper.isValid(value.phoneNumber)) {
    const phoneNumber = normalizePhoneNumber(value.phoneNumber, rule.properties?.defaultCountryCode)

    if (phoneNumber) {
      return {
        ...value,
        phoneNumber
      }
    }
  }

  return value
}

export function fieldValuesToAnswers(
  fields: FormField[],
  values: Record<string, any>,
  partialSubmission?: boolean
): Answer[] {
  const rules = fieldsToValidateRules(fields)
  const answers: Answer[] = []

  for (const rule of rules) {
    let value = values[rule.id]

    if (partialSubmission) {
      try {
        // Validate the value, if it fails, an exception will be thrown
        validate(rule, value)
        value = normalizeAnswerValue(rule, value)

        answers.push({
          id: rule.id,
          title: rule.title,
          kind: rule.kind,
          properties: rule.properties || {},
          value
        } as any)
      } catch (_) {}

      // Partial submission does not need to throw error
      continue
    }

    // Validate the value, if it fails, an exception will be thrown
    validate(rule, value)
    value = normalizeAnswerValue(rule, value)

    if (helper.isEmpty(value)) {
      if (CHOICES_FIELD_KINDS.includes(rule.kind)) {
        value = {
          value: []
        }
      } else if (rule.kind === FieldKindEnum.CONTACT_INFO) {
        value = {}
      } else {
        value = ''
      }
    }

    answers.push({
      id: rule.id,
      title: rule.title,
      kind: rule.kind,
      properties: rule.properties || {},
      value
    } as any)
  }

  return answers
}
