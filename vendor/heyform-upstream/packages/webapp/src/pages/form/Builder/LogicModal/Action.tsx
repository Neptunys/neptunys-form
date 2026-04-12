import { flattenFieldsWithGroups } from '@heyform-inc/form-renderer'
import { ActionEnum, LogicAction, Variable } from '@heyform-inc/shared-types-enums'
import { IconPlus } from '@tabler/icons-react'
import { type FC, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/utils'
import { htmlUtils } from '@heyform-inc/answer-utils'
import { helper } from '@heyform-inc/utils'

import { Button, Input, Select } from '@/components'
import { ACTIONS, OPERATORS } from '@/consts'
import { useAppStore } from '@/store'
import { FormFieldType } from '@/types'

import { QuestionIcon } from '../LeftSidebar/QuestionList'

interface QuestionSelectProps {
  fields: FormFieldType[]
  value?: string
  onChange?: (value: string) => void
}

interface ActionProps {
  fields: FormFieldType[]
  currentField: FormFieldType
  variables?: Variable[]
  value?: LogicAction
  onChange?: (value: LogicAction) => void
}

const QuestionSelect: FC<QuestionSelectProps> = ({ fields, value, onChange }) => {
  const options = useMemo(
    () =>
      fields.map(row => ({
        value: row.id,
        label: (
          <div className="flex w-full items-center gap-x-2">
            <QuestionIcon kind={row.kind} index={row.index} parentIndex={row.parent?.index} />
            <span className="flex-1 truncate text-left">
              {htmlUtils.plain(row.title as string)}
            </span>
          </div>
        )
      })),
    [fields]
  )

  return <Select options={options} value={value} onChange={onChange} />
}

export default function Action({
  fields: rawFields,
  currentField,
  variables = [],
  value: rawValue,
  onChange
}: ActionProps) {
  const { t } = useTranslation()

  const { openModal } = useAppStore()

  const [value, setValue] = useState<Any>(rawValue || {})

  const fields = useMemo(() => {
    const tmpFields = flattenFieldsWithGroups(rawFields)
    const index = tmpFields.findIndex(f => f.id === currentField.id)

    return tmpFields.slice(index + 1)
  }, [rawFields, currentField])
  const selectedVariable = useMemo(
    () => variables.find(variable => variable.id === value?.variable),
    [value?.variable, variables]
  )
  const operatorOptions = useMemo(() => {
    if (selectedVariable?.kind === 'string') {
      return OPERATORS.filter(operator => operator.value === 'assignment')
    }

    return OPERATORS
  }, [selectedVariable?.kind])
  const valueInputType = selectedVariable?.kind === 'number' ? 'number' : 'text'

  function handleKindChange(kind: any) {
    if (kind === ActionEnum.CALCULATE) {
      let { variable, operator } = value as Any

      if (helper.isEmpty(variable) && helper.isValidArray(variables)) {
        variable = variables[0].id
      }

      const nextVariable = variables.find(row => row.id === variable)

      if (nextVariable?.kind === 'string') {
        operator = 'assignment'
      } else if (typeof operator !== 'string' || helper.isEmpty(operator)) {
        operator = OPERATORS[0].value
      }

      handleChange({ ...value, kind, variable, operator })
    } else {
      handleChange({ ...value, kind })
    }
  }

  function handleFieldChange(fieldId: string) {
    handleChange({
      ...value,
      fieldId
    })
  }

  function handleVariableChange(variable: any) {
    const nextVariable = variables.find(row => row.id === variable)

    handleChange({
      ...value,
      variable,
      operator:
        nextVariable?.kind === 'string'
          ? 'assignment'
          : typeof value?.operator === 'string'
            ? value.operator
            : OPERATORS[0].value
    })
  }

  function handleOperatorChange(operator: any) {
    handleChange({ ...value, operator })
  }

  function handleInputChange(newValue: any) {
    handleChange({ ...value, value: newValue })
  }

  function handleChange(newValue: any) {
    setValue(newValue)
    onChange?.(newValue)
  }

  useEffect(() => {
    setValue(rawValue || {})
  }, [rawValue])

  useEffect(() => {
    if (value?.kind !== ActionEnum.CALCULATE || !selectedVariable) {
      return
    }

    const nextOperator =
      selectedVariable.kind === 'string'
        ? 'assignment'
        : typeof value.operator === 'string'
          ? value.operator
          : OPERATORS[0].value

    if (nextOperator !== value.operator) {
      handleChange({ ...value, operator: nextOperator })
    }
  }, [selectedVariable, value])

  return (
    <div
      className={cn('rule-action', {
        'rule-action-calculate': value.kind === ActionEnum.CALCULATE
      })}
    >
      <div className="text-sm leading-10">{t('form.builder.logic.rule.then')}</div>

      <Select
        className="w-auto flex-1"
        options={ACTIONS}
        value={value.kind}
        multiLanguage
        onChange={handleKindChange}
      />
      {value.kind === ActionEnum.NAVIGATE ? (
        <QuestionSelect fields={fields} value={value.fieldId} onChange={handleFieldChange} />
      ) : helper.isValidArray(variables) ? (
        <div className="rule-action-calculate-panel">
          <div className="rule-action-calculate-grid">
            <label className="rule-action-input-group">
              <span className="rule-action-input-label">Variable</span>
              <Select
                className="w-full"
                options={variables}
                labelKey="name"
                valueKey="id"
                value={value.variable}
                placeholder="Choose a variable"
                onChange={handleVariableChange}
              />
            </label>
            <label className="rule-action-input-group">
              <span className="rule-action-input-label">Operation</span>
              <Select
                className="w-full"
                options={operatorOptions}
                value={value.operator}
                placeholder="Choose an operation"
                multiLanguage
                onChange={handleOperatorChange}
              />
            </label>
            <label className="rule-action-input-group">
              <span className="rule-action-input-label">
                {selectedVariable?.kind === 'number' ? 'Points' : 'Value'}
              </span>
              <Input
                type={valueInputType}
                placeholder={selectedVariable?.kind === 'number' ? 'e.g. 10' : 'e.g. qualified'}
                className="w-full"
                value={value.value}
                onChange={handleInputChange}
              />
            </label>
          </div>

          <div className="rule-action-help">
            {selectedVariable?.kind === 'number'
              ? 'Quiz scoring works best with one number variable that starts at 0. Use Add to award points and Assign only when you want to replace the score.'
              : 'Text variables are better for labels or outcomes. They only support Assign so the result stays predictable.'}
          </div>
        </div>
      ) : (
        <Button.Link onClick={() => openModal('VariableModal')}>
          <IconPlus />
          {t('form.builder.logic.variable.addVariable')}
        </Button.Link>
      )}
    </div>
  )
}
