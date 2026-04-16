import { LayoutProps } from '@heyooo-inc/react-router'
import { IconMenu } from '@tabler/icons-react'
import { useAsyncEffect } from 'ahooks'
import { FC, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'

import { UserService, WorkspaceService } from '@/services'
import { clearAuthState, clearCookie, cn, getCookie, useParam, useRouter } from '@/utils'
import { helper, timestamp } from '@heyform-inc/utils'

import brandLogo from '@/assets/neptunys-logo.png'
import { AppStateScreen, Button, useAlert } from '@/components'
import { REDIRECT_COOKIE_NAME, VERIFY_USER_EMAIL } from '@/consts'
import { useAppStore, useUserStore, useWorkspaceStore } from '@/store'

import { FormShell } from '../Form/FormShell'
import { ProjectShell } from '../Project/ProjectShell'
import ChangePasswordModal from './ChangePasswordModal'
import ChangelogsModal from './ChangelogsModal'
import CreateFormModal from './CreateFormModal'
import CreateProjectModal from './CreateProjectModal'
import CreateWorkspaceModal from './CreateWorkspaceModal'
import DeleteProjectModal from './DeleteProjectModal'
import SearchModal from './SearchModal'
import UserAccountModal from './UserAccountModal'
import UserDeletionModal from './UserDeletionModal'
import WorkspaceAccount from './WorkspaceAccount'
import WorkspaceSidebar, { WorkspaceSidebarModal } from './WorkspaceSidebar'

const APP_NAME = 'NeptunysForm'

function shouldResetSession(err: any) {
  const message = String(err?.message || '').toLowerCase()
  const status = Number(err?.status || err?.networkError?.statusCode || err?.cause?.status)

  if (status === 401) {
    return true
  }

  return status >= 500 || message.includes('status code 500')
}

export const LoginGuard: FC<LayoutProps> = ({ options, children }) => {
  const { t } = useTranslation()

  const alert = useAlert()
  const router = useRouter()
  const { user, setUser, updateUser } = useUserStore()
  const [isCheckingUser, setCheckingUser] = useState(true)
  const [guardError, setGuardError] = useState<string>()

  useAsyncEffect(async () => {
    try {
      const user = await UserService.userDetail()
      setUser(user)

      if (VERIFY_USER_EMAIL && !user.isEmailVerified && window.location.pathname !== '/verify-email') {
        return router.replace('/verify-email')
      }
    } catch (err: any) {
      if (shouldResetSession(err)) {
        clearAuthState()
        window.location.href = '/logout'
        return
      }

      setGuardError(err?.message || 'Failed to load user session')
    } finally {
      setCheckingUser(false)
    }
  }, [])

  useEffect(() => {
    if (user.isDeletionScheduled) {
      alert({
        title: t('user.deletion.scheduled.title'),
        description: t('user.deletion.scheduled.description', {
          remainingTime: Math.ceil(((user.deletionScheduledAt || 0) - timestamp()) / 3600)
        }),
        cancelProps: {
          label: t('components.cancel')
        },
        confirmProps: {
          label: t('user.deletion.scheduled.cancel'),
          className: 'bg-error text-primary-light dark:text-primary hover:bg-error'
        },
        fetch: async () => {
          await UserService.cancelDeletion()

          updateUser({
            isDeletionScheduled: false,
            deletionScheduledAt: 0
          })
        }
      })
    }
  }, [user.deletionScheduledAt, user.isDeletionScheduled])

  useEffect(() => {
    if (helper.isValid(options?.title)) {
      document.title = `${t(options!.title)} - ${APP_NAME}`
    }
  }, [options, t])

  if (isCheckingUser) {
    return <AppStateScreen title="Loading workspace" message="Checking your session..." />
  }

  if (guardError) {
    return <AppStateScreen title="App failed to load" message={guardError} status="error" />
  }

  return <>{children}</>
}

const INVITATION_URL_REGEX = /\/workspace\/[^/]+\/invitation\/[^/]+/i

export const WorkspaceGuard: FC<LayoutProps> = ({ options, children }) => {
  const { t } = useTranslation()

  const router = useRouter()
  const location = useLocation()
  const { workspaceId, projectId } = useParam()
  const redirectUri = getCookie(REDIRECT_COOKIE_NAME) as string

  const {
    workspaces: wsCache,
    workspace,
    project,
    currentWorkspaceId,
    setWorkspaces,
    selectWorkspace,
    selectProject
  } = useWorkspaceStore()

  const [isMounted, setMounted] = useState(false)
  const [guardError, setGuardError] = useState<string>()

  async function fetch() {
    const result = await WorkspaceService.workspaces()

    setWorkspaces(result)

    if (INVITATION_URL_REGEX.test(redirectUri)) {
      clearCookie(REDIRECT_COOKIE_NAME)
      return router.redirect(redirectUri)
    }

    if (helper.isEmpty(result)) {
      return router.redirect('/workspace/create')
    }

    return result
  }

  useAsyncEffect(async () => {
    try {
      let workspaces = wsCache

      if (helper.isEmpty(wsCache)) {
        workspaces = await fetch()

        if (helper.isNil(workspaces)) {
          return
        }
      } else {
        fetch().catch(() => undefined)
      }

      setGuardError(undefined)
      setMounted(true)

      if (options?.isHomePage) {
        if (helper.isValid(redirectUri)) {
          clearCookie(REDIRECT_COOKIE_NAME)

          return router.redirect(redirectUri, {
            extend: false
          })
        }

        let targetWorkspaceId = workspaces[0].id

        if (helper.isValid(currentWorkspaceId)) {
          const index = workspaces.findIndex(w => w.id === currentWorkspaceId)

          if (index > -1) {
            targetWorkspaceId = currentWorkspaceId!
          }
        }

        return router.redirect(`/workspace/${targetWorkspaceId}`, {
          extend: false
        })
      }
    } catch (err: any) {
      setGuardError(err?.message || 'Failed to load workspaces')
      setMounted(true)
    }
  }, [location])

  useEffect(() => {
    selectWorkspace(workspaceId)

    if (workspaceId) {
      let title = `${workspace?.name} - ${APP_NAME}`

      if (helper.isValid(options?.title)) {
        title = `${t(options!.title)} · ` + title
      }

      document.title = title
    }
  }, [options, selectWorkspace, t, workspace?.name, workspaceId])

  useEffect(() => {
    selectProject(projectId)

    if (projectId) {
      let title = `${workspace?.name}/${project?.name} - ${APP_NAME}`

      if (helper.isValid(options?.title)) {
        title = `${t(options!.title)} · ` + title
      }

      document.title = title
    }
  }, [options, project?.name, projectId, selectProject, t, workspace?.name])

  return (
    <LoginGuard>
      {!isMounted && <AppStateScreen title="Loading workspace" message="Fetching workspaces..." />}
      {isMounted && guardError && <AppStateScreen title="Workspace failed to load" message={guardError} status="error" />}
      {isMounted && !guardError && options?.isHomePage && (
        <AppStateScreen title="Opening workspace" message="Redirecting to your last workspace..." />
      )}
      {isMounted && !guardError && !options?.isHomePage && children}

      <UserAccountModal />
      <UserDeletionModal />
      <ChangePasswordModal />
      <SearchModal />
    </LoginGuard>
  )
}

export const BaseLayout: FC<LayoutProps> = ({ options, children }) => {
  const { t } = useTranslation()

  useEffect(() => {
    if (helper.isValid(options?.title)) {
      document.title = `${t(options!.title)} - ${APP_NAME}`
    }
  }, [options, t])

  return (
    <LoginGuard>
      <div className="bg-foreground flex min-h-screen flex-col">
        <div className="bg-foreground sticky top-0 flex items-center justify-between p-4">
          <a href="/" className="flex items-center gap-2" title={APP_NAME}>
            <img src={brandLogo} alt={APP_NAME} className="h-8 w-auto object-contain" />
            <span className="text-xl font-medium">{APP_NAME}</span>
          </a>

          <WorkspaceAccount
            className="!p-0 hover:!bg-transparent hover:!outline-none [&_[data-slot=avatar]]:h-9 [&_[data-slot=avatar]]:w-9"
            containerClassName="!p-0 border-none flex items-center"
            isNameVisible={false}
          />
        </div>

        <div className="flex flex-1 flex-col justify-center p-4 lg:p-12">{children}</div>
      </div>

      <UserAccountModal />
      <UserDeletionModal />
      <ChangePasswordModal />
    </LoginGuard>
  )
}

const LayoutComponent: FC<LayoutProps> = ({ options, children }) => {
  const { t } = useTranslation()

  const { workspaceId, projectId } = useParam()
  const { openModal } = useAppStore()
  const { workspaces, workspace, project, currentWorkspaceId, currentProjectId, selectWorkspace, selectProject } = useWorkspaceStore()

  const matchedWorkspace = useMemo(
    () => workspaces.find(w => w.id === workspaceId),
    [workspaces, workspaceId]
  )
  const matchedProject = useMemo(
    () => matchedWorkspace?.projects.find(p => p.id === projectId),
    [matchedWorkspace, projectId]
  )

  useEffect(() => {
    if (workspaceId && currentWorkspaceId !== workspaceId) {
      selectWorkspace(workspaceId)
    }
  }, [currentWorkspaceId, selectWorkspace, workspaceId])

  useEffect(() => {
    if (projectId && currentProjectId !== projectId) {
      selectProject(projectId)
    }
  }, [currentProjectId, projectId, selectProject])

  if (workspaceId && helper.isEmpty(workspaces)) {
    return <AppStateScreen title="Loading workspace" message="Preparing your workspace..." />
  }

  if (!matchedWorkspace) {
    return (
      <BaseLayout>
        <div className="flex flex-grow items-center justify-center">
          <div className="text-center">
            <h1 className="mb-4 text-2xl font-semibold">{t('workspace.noAccess')}</h1>
          </div>
        </div>
      </BaseLayout>
    )
  }

  if (projectId && !matchedProject) {
    return (
      <BaseLayout>
        <div className="flex flex-grow items-center justify-center">
          <div className="text-center">
            <h1 className="mb-4 text-2xl font-semibold">{t('workspace.noAccess')}</h1>
          </div>
        </div>
      </BaseLayout>
    )
  }

  return (
    <>
      <div
        className={cn(
          'relative isolate flex min-h-svh w-full max-lg:flex-col',
          {
            '[&_[data-slot=layout-main]]:pt-16 [&_[data-slot=layout-main]]:lg:pt-16 [&_[data-slot=layout-sidebar]]:top-16': false
          },
          options?.className
        )}
      >
        <WorkspaceSidebar />

        <main
          className="bg-foreground flex flex-1 flex-col lg:min-w-0 lg:pl-64"
          data-slot="layout-main"
        >
          <div className="grow" data-slot="layout-container">
            <div className="hf-page-shell flex min-h-full flex-col" data-slot="layout-inner">
              <div className="mb-6 flex items-center justify-between lg:hidden">
                <Button.Link
                  size="md"
                  className="-ml-2"
                  iconOnly
                  onClick={() => openModal('WorkspaceSidebarModal')}
                >
                  <IconMenu />
                </Button.Link>

                <WorkspaceAccount
                  className="!p-0 hover:!bg-transparent hover:!outline-none [&_[data-slot=avatar]]:h-9 [&_[data-slot=avatar]]:w-9"
                  containerClassName="!p-0 border-none flex items-center"
                  isNameVisible={false}
                />
              </div>

              {options?.formShell ? (
                <FormShell>{children}</FormShell>
              ) : options?.projectShell ? (
                <ProjectShell>{children}</ProjectShell>
              ) : (
                children
              )}
            </div>
          </div>
        </main>
      </div>

      <WorkspaceSidebarModal />
      <CreateWorkspaceModal />
      <CreateProjectModal />
      <CreateFormModal />
      <DeleteProjectModal />
      <ChangelogsModal />
    </>
  )
}

export const WorkspaceLayout: FC<LayoutProps> = ({ options, children }) => (
  <WorkspaceGuard options={options}>
    <LayoutComponent options={options}>{children}</LayoutComponent>
  </WorkspaceGuard>
)
