import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { FormService } from '@/services'
import { useParam } from '@/utils'

import IconAI from '@/assets/ai.svg?react'
import { Button, Form, Input, Modal, useToast } from '@/components'
import { useAppStore, useFormStore, useModal } from '@/store'

import { useStoreContext } from './store'

interface GeneratedAIDraft {
  name?: string
  kind?: string
  drafts?: AnyMap[]
}

const GenerateWithAIForm = () => {
  const { t } = useTranslation()

  const { formId } = useParam()
  const { closeModal } = useAppStore()
  const { updateForm } = useFormStore()
  const { state, dispatch } = useStoreContext()
  const [rcForm] = Form.useForm()
  const toast = useToast()

  const examples = useMemo(
    () => Array.from({ length: 3 }).map((_, index) => t(`form.ai.topic.examples.${index}`)),
    [t]
  )

  async function fetch(values: { prompt: string; reference?: string }) {
    const result = await FormService.createFieldsWithAI(
      formId,
      values.prompt,
      values.reference
    )
    const generated = result as GeneratedAIDraft
    const drafts = Array.isArray(generated?.drafts) ? generated.drafts : []

    if (!drafts.length) {
      throw new Error('The AI builder did not return a usable form flow.')
    }

    const metadataUpdates: AnyMap = {}

    if (generated.name) {
      metadataUpdates.name = generated.name
    }

    if (generated.kind) {
      metadataUpdates.kind = generated.kind
    }

    if (Object.keys(metadataUpdates).length > 0) {
      await FormService.update(formId, metadataUpdates)
      updateForm(metadataUpdates)
    }

    dispatch({
      type: 'cleanLogics',
      payload: undefined
    })
    dispatch({
      type: 'setActiveTabName',
      payload: {
        activeTabName: 'question'
      }
    })
    dispatch({
      type: 'setFields',
      payload: {
        fields: drafts as any
      }
    })

    if (drafts[0]?.id) {
      dispatch({
        type: 'selectField',
        payload: {
          id: drafts[0].id
        }
      })
    }

    closeModal('GenerateWithAIModal')

    toast({
      title: t('form.creation.ai.headline'),
      message: 'The full form flow has been generated.'
    })
  }

  return (
    <Form.Simple
      className="space-y-4"
      form={rcForm}
      fetch={fetch}
      refreshDeps={[formId]}
      submitProps={{
        className: 'px-5 min-w-24',
        size: 'md',
        label: 'Generate flow',
        disabled: state.isSyncing
      }}
    >
      <div className="space-y-2">
        <Form.Item
          name="prompt"
          label="Prompt"
          description={t('form.ai.topic.description')}
          rules={[
            {
              required: true,
              message: t('form.ai.topic.required')
            }
          ]}
        >
          <Input.TextArea autoComplete="off" />
        </Form.Item>

        <div>
          <p className="text-sm/6">{t('form.ai.topic.ideasForYou')}</p>
          <ul className="mt-1">
            {examples.map((row, index) => (
              <li key={index}>
                <Button.Link
                  className="!h-auto w-full px-1.5 py-2 text-left sm:px-1.5 sm:py-1.5 [&_[data-slot=button]]:items-center [&_[data-slot=button]]:justify-start"
                  onClick={() => rcForm.setFieldValue('prompt', row)}
                >
                  <IconAI className="h-5 w-5" />
                  <span>{row}</span>
                </Button.Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Form.Item
        name="reference"
        label={t('form.ai.reference.label')}
        description={t('form.ai.reference.description')}
      >
        <Input.TextArea autoComplete="off" rows={6} maxLength={2000} />
      </Form.Item>
    </Form.Simple>
  )
}

export default function GenerateWithAIModal() {
  const { isOpen, onOpenChange } = useModal('GenerateWithAIModal')

  return (
    <Modal.Simple
      open={isOpen}
      title="AI form builder"
      description="Describe the form you want and the builder will replace the current draft with a full welcome, question flow, and thank-you screen. Design and settings stay in place."
      onOpenChange={onOpenChange}
    >
      <GenerateWithAIForm />
    </Modal.Simple>
  )
}