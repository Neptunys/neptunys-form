import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { WorkspaceService } from '@/services'
import { useParam, useRouter } from '@/utils'
import { helper } from '@neptunysform-inc/utils'

import { Async, EmptyState, Repeat } from '@/components'
import { useAppStore, useWorkspaceStore } from '@/store'
import { FormType } from '@/types'

import FormItem from '../../project/Forms/FormItem'

export default function RecentForms() {
  const { t } = useTranslation()

  const router = useRouter()
  const { workspaceId } = useParam()
  const { openModal } = useAppStore()
  const { workspace, currentProjectId } = useWorkspaceStore()

  const [data, setData] = useState<FormType[]>([])

  async function fetch() {
    if (!workspaceId) {
      return false
    }

    const result = await WorkspaceService.recentForms(workspaceId)

    setData(result)
    return helper.isValid(result)
  }

  function handleCreateForm() {
    if (helper.isValidArray(workspace?.projects)) {
      const targetProjectId =
        currentProjectId && workspace.projects.some(project => project.id === currentProjectId)
          ? currentProjectId
          : workspace.projects[0].id

      router.push(`/workspace/${workspaceId}/project/${targetProjectId}/`, {
        state: {
          isCreateModalOpen: true
        }
      })
    } else {
      openModal('CreateProjectModal')
    }
  }

  return (
    <Async
      fetch={fetch}
      refreshDeps={[workspaceId]}
      loader={
        <div className="mt-4">
          <Repeat count={3}>
            <FormItem.Skeleton />
          </Repeat>
        </div>
      }
      errorRender={err => (
        <div className="mt-4">
          <div className="hf-card p-5 text-sm/6 text-red-600">{err.message}</div>
        </div>
      )}
      emptyRender={() => (
        <div className="mt-4">
          <EmptyState
            headline={t('dashboard.noForms')}
            subHeadline={t('dashboard.pickTemplate')}
            buttonTitle={t('form.creation.title')}
            onClick={handleCreateForm}
          />
        </div>
      )}
    >
      <div className="mt-4">
        {data.map(f => (
          <FormItem key={f.id} form={f} />
        ))}
      </div>
    </Async>
  )
}
