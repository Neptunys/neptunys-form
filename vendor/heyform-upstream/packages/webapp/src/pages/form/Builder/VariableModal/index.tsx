import { Variable } from '@heyform-inc/shared-types-enums'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { helper, nanoid } from '@heyform-inc/utils'

import { Form, Input, Modal, Select } from '@/components'
import { VARIABLE_INPUT_TYPES, VARIABLE_KIND_CONFIGS } from '@/consts'
import { useAppStore, useModal } from '@/store'

import { useStoreContext } from '../store'

const VariableComponent = () => {
  const { t } = useTranslation()

  const { state, dispatch } = useStoreContext()
  const { closeModal } = useAppStore()

  const [kind, setKind] = useState<string>('number')
  const isEditing = useMemo(() => helper.isValid(state.selectedVariable), [state.selectedVariable])
  const isScoreVariable = kind === 'number'

  const options = useMemo(
    () =>
      VARIABLE_KIND_CONFIGS.map(row => ({
        value: row.kind,
        icon: (
          <row.icon
            className="h-6 w-6 rounded p-0.5"
            style={{
              background: row.backgroundColor,
              color: row.textColor
            }}
          />
        ),
        label: t(row.label)
      })),
    [t]
  )

  async function handleFinish(values: Variable) {
    if (isEditing) {
      dispatch({
        type: 'updateVariable',
        payload: {
          id: state.selectedVariable!.id,
          updates: values
        }
      })
    } else {
      dispatch({
        type: 'addVariable',
        payload: {
          ...values,
          id: nanoid(12)
        }
      })
    }

    closeModal('VariableModal')
  }

  function handleValuesChange(changes: any) {
    if (changes.kind) {
      setKind(changes.kind)
    }
  }

  useEffect(() => {
    if (state.selectedVariable) {
      setKind(state.selectedVariable.kind)
    }
  }, [state.selectedVariable])

  return (
    <Form.Simple
      className="space-y-4"
      initialValues={{
        kind,
        value: state.selectedVariable?.value ?? (isScoreVariable ? 0 : ''),
        ...state.selectedVariable
      }}
      submitProps={{
        size: 'md',
        label: t(
          isEditing
            ? 'form.builder.logic.variable.updateVariable'
            : 'form.builder.logic.variable.addVariable'
        )
      }}
      fetch={handleFinish}
      submitOnChangedOnly
      onValuesChange={handleValuesChange}
    >
      <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm/6 text-slate-700">
        {isScoreVariable
          ? 'Use a number variable for quiz scoring. Start it at 0, then add or subtract points in your answer rules.'
          : 'Use a text variable for labels or outcomes such as pass/fail, recommendation tier, or routing state.'}
      </div>

      <Form.Item
        name="kind"
        label={t('form.builder.logic.variable.type')}
        rules={[{ required: true }]}
      >
        <Select className="h-11 w-full sm:h-10" options={options} />
      </Form.Item>
      <Form.Item
        name="name"
        label={t('form.builder.logic.variable.name')}
        rules={[{ required: true }]}
      >
        <Input placeholder={isScoreVariable ? 'e.g. total_score' : 'e.g. result_label'} />
      </Form.Item>
      <Form.Item
        name="value"
        label={isScoreVariable ? 'Starting score' : t('form.builder.logic.variable.defaultValue')}
        rules={[{ required: true }]}
      >
        <Input
          type={VARIABLE_INPUT_TYPES[kind]}
          placeholder={isScoreVariable ? '0' : 'e.g. qualified'}
        />
      </Form.Item>
    </Form.Simple>
  )
}

export default function VariableModal() {
  const { t } = useTranslation()
  const { isOpen, onOpenChange } = useModal('VariableModal')

  return (
    <Modal.Simple
      open={isOpen}
      title={t('form.builder.logic.variable.headline')}
      description={t('form.builder.logic.variable.subHeadline')}
      onOpenChange={onOpenChange}
    >
      <VariableComponent />
    </Modal.Simple>
  )
}
