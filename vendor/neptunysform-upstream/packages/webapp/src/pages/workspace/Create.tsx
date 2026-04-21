import { useRequest } from 'ahooks'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { CreateWorkspaceForm } from '@/layouts/Workspace/CreateWorkspaceModal'
import { WorkspaceService } from '@/services'
import { useWorkspaceStore } from '@/store'
import { canCreateWorkspace, useRouter } from '@/utils'

export default function CreateWorkspace() {
  const { t } = useTranslation()
  const router = useRouter()
  const { workspaces, setWorkspaces } = useWorkspaceStore()

  const { data } = useRequest(async () => {
    const result = await WorkspaceService.workspaces()

    setWorkspaces(result)
    return result
  })

  const resolvedWorkspaces = useMemo(
    () => (workspaces.length > 0 ? workspaces : ((data as typeof workspaces | undefined) ?? [])),
    [data, workspaces]
  )
  const canCreate = canCreateWorkspace(resolvedWorkspaces)

  useEffect(() => {
    if (!canCreate && resolvedWorkspaces.length > 0) {
      router.replace(`/workspace/${resolvedWorkspaces[0].id}`)
    }
  }, [canCreate, resolvedWorkspaces, router])

  if (!canCreate && resolvedWorkspaces.length > 0) {
    return null
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-semibold">{t('workspace.creation.headline')}</h1>
      <p className="text-secondary mt-2 text-sm">{t('workspace.creation.subHeadline')}</p>
      <div className="mt-10">
        <CreateWorkspaceForm />
      </div>
    </div>
  )
}
