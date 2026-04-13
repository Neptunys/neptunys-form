import { FC, ReactNode, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation } from 'react-router-dom'

import { cn, useParam } from '@/utils'

import { Button } from '@/components'
import { useAppStore, useWorkspaceStore } from '@/store'

import ProjectMembers from './ProjectMembers'
import ProjectMembersModal from './ProjectMembersModal'

interface ProjectShellProps {
  children: ReactNode
}

export const ProjectShell: FC<ProjectShellProps> = ({ children }) => {
  const { t } = useTranslation()

  const location = useLocation()
  const { workspaceId, projectId } = useParam()
  const { openModal } = useAppStore()
  const { project } = useWorkspaceStore()

  const navigations = useMemo(
    () => [
      {
        value: 'forms',
        label: 'Forms',
        to: `/workspace/${workspaceId}/project/${projectId}/`
      },
      {
        value: 'settings',
        label: 'Settings',
        to: `/workspace/${workspaceId}/project/${projectId}/settings`
      },
      {
        value: 'trash',
        label: t('project.trash.title'),
        to: `/workspace/${workspaceId}/project/${projectId}/trash`
      },
      {
        value: 'experiments',
        label: 'Experiments',
        to: `/workspace/${workspaceId}/project/${projectId}/experiments`
      }
    ],
    [projectId, workspaceId, t]
  )

  useEffect(() => {
    if (location.state?.isCreateModalOpen) {
      window.history.replaceState({}, '')
      openModal('CreateFormModal')
    }
  }, [location.state?.isCreateModalOpen])

  useEffect(() => {
    return () => {
      window.history.replaceState({}, '')
    }
  }, [])

  return (
    <>
      <div className="w-full">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl/8 font-semibold sm:text-xl/8">{project?.name}</h1>

            <Button size="md" onClick={() => openModal('CreateFormModal')}>
              {t('form.creation.title')}
            </Button>
          </div>

          <ProjectMembers />

          <div className="border-accent-light mt-5 border-b">
            <nav className="text-secondary flex items-center gap-6 text-sm font-medium">
              {navigations.map(n => (
                <NavLink
                  key={n.value}
                  className={({ isActive }) =>
                    cn('hover:text-primary py-3', {
                      'text-primary after:bg-primary relative after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full':
                        isActive
                    })
                  }
                  to={n.to}
                  end
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </div>

          {children}
        </div>
      </div>

      <ProjectMembersModal />
    </>
  )
}
