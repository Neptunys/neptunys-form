import { useEffect, useState } from 'react'

import FormRender from './index'
import { AppStateScreen } from '@/components'
import { WorkspaceService } from '@/services'
import { REDIRECT_COOKIE_NAME } from '@/consts'
import { useWorkspaceStore } from '@/store'
import { clearAuthState, clearCookie, getAuthState, getCookie, isCustomDomainRuntimeCandidate } from '@/utils'

export default function RootEntry() {
  const { currentWorkspaceId, setWorkspaces } = useWorkspaceStore()
  const [state, setState] = useState<'checking' | 'public' | 'error'>('checking')
  const [message, setMessage] = useState('Checking where to send you...')

  useEffect(() => {
    let isCancelled = false

    async function resolveRoot() {
      if (isCustomDomainRuntimeCandidate(window.location.hostname)) {
        if (!isCancelled) {
          setState('public')
        }

        return
      }

      if (!getAuthState()) {
        window.location.replace('/login')
        return
      }

      try {
        setMessage('Loading workspaces...')

        const workspaces = await WorkspaceService.workspaces()

        if (isCancelled) {
          return
        }

        setWorkspaces(workspaces)

        const redirectUri = getCookie(REDIRECT_COOKIE_NAME) as string

        if (redirectUri) {
          clearCookie(REDIRECT_COOKIE_NAME)
          window.location.replace(redirectUri)
          return
        }

        if (!workspaces.length) {
          window.location.replace('/workspace/create')
          return
        }

        const targetWorkspaceId =
          currentWorkspaceId && workspaces.some(workspace => workspace.id === currentWorkspaceId)
            ? currentWorkspaceId
            : workspaces[0].id

        window.location.replace(`/workspace/${targetWorkspaceId}`)
      } catch (err: any) {
        if (isCancelled) {
          return
        }

        const errorMessage = err?.message || 'Failed to open the workspace home page.'

        if (/unauthorized/i.test(errorMessage)) {
          clearAuthState()
          window.location.replace('/login')
          return
        }

        setState('error')
        setMessage(errorMessage)
      }
    }

    resolveRoot()

    return () => {
      isCancelled = true
    }
  }, [currentWorkspaceId, setWorkspaces])

  if (state === 'public') {
    return <FormRender resolveDomainRoot />
  }

  if (state === 'error') {
    return <AppStateScreen title="Workspace unavailable" message={message} status="error" />
  }

  return <AppStateScreen title="Opening page" message={message} />
}