import { useState } from 'react'

import { useRequest } from 'ahooks'
import { useTranslation } from 'react-i18next'

import { WorkspaceService } from '@/services'
import { normalizeCustomDomain, useParam } from '@/utils'

import { Button, ImageFormPicker, Input } from '@/components'
import { useWorkspaceStore } from '@/store'

export default function WorkspaceGeneral() {
  const { t } = useTranslation()
  const [currentWizardStep, setCurrentWizardStep] = useState(0)

  const { workspaceId } = useParam()
  const { workspace, updateWorkspace } = useWorkspaceStore()
  const normalizedDomain = normalizeCustomDomain(workspace?.customDomain)
  const runtimeHost = window.location.hostname.toLowerCase()
  const runtimePort = window.location.port
  const isLocalRuntime = runtimeHost === 'localhost' || runtimeHost === '127.0.0.1'
  const liveDomainBase = normalizedDomain ? `https://${normalizedDomain}` : undefined
  const localDomainBase = normalizedDomain
    ? `${window.location.protocol}//${normalizedDomain}${runtimePort ? `:${runtimePort}` : ''}`
    : undefined
  const suggestedRecordName = normalizedDomain
    ? normalizedDomain.split('.').slice(0, -2).join('.') || '@'
    : 'form'
  const suggestedRecordValue = isLocalRuntime ? '127.0.0.1' : runtimeHost
  const wizardSteps = [
    {
      title: 'Create only the subdomain',
      description: 'Use a dedicated subdomain like `form.client.com`, not the main site domain.',
      content: (
        <div className="space-y-3 text-sm/6">
          <div className="rounded-xl border border-accent-light px-3 py-3">
            <div className="text-primary font-medium">Good</div>
            <div className="text-secondary mt-1">`form.client.com` keeps the existing website fully intact.</div>
          </div>
          <div className="rounded-xl border border-accent-light px-3 py-3">
            <div className="text-primary font-medium">Avoid</div>
            <div className="text-secondary mt-1">`client.com` would replace the main website root instead of adding a form subdomain.</div>
          </div>
        </div>
      )
    },
    {
      title: 'Add the connection record',
      description: isLocalRuntime
        ? 'For local testing, add a hosts-file entry that points the subdomain to this machine.'
        : 'Point that subdomain to this NeptunysForm deployment so public pages load from the same app.',
      content: (
        <div className="space-y-3 text-sm/6">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-accent-light px-3 py-2">
            <div>
              <div className="text-secondary text-xs uppercase tracking-[0.16em]">Record type</div>
              <div className="text-primary font-medium">{isLocalRuntime ? 'Hosts file' : 'CNAME'}</div>
            </div>
            <Button.Copy text={isLocalRuntime ? 'Hosts file' : 'CNAME'} label="Copy" size="sm" />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-accent-light px-3 py-2">
            <div>
              <div className="text-secondary text-xs uppercase tracking-[0.16em]">Name / host</div>
              <div className="text-primary font-medium">{suggestedRecordName}</div>
            </div>
            <Button.Copy text={suggestedRecordName} label="Copy" size="sm" />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-accent-light px-3 py-2">
            <div>
              <div className="text-secondary text-xs uppercase tracking-[0.16em]">Value / target</div>
              <div className="text-primary break-all font-medium">{suggestedRecordValue}</div>
            </div>
            <Button.Copy text={suggestedRecordValue} label="Copy" size="sm" />
          </div>
        </div>
      )
    },
    {
      title: 'Save the domain here',
      description: 'Once the record is in place, NeptunysForm will automatically build public links from this domain.',
      content: liveDomainBase ? (
        <div className="rounded-xl border border-accent-light px-3 py-3 text-sm/6">
          <div className="text-secondary text-xs uppercase tracking-[0.16em]">Live domain</div>
          <div className="text-primary mt-1 break-all font-medium">{liveDomainBase}</div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-accent-light px-3 py-3 text-sm/6">
          <div className="text-secondary">Enter the client subdomain above and the live domain preview will appear here.</div>
        </div>
      )
    },
    {
      title: 'Give every form a short path',
      description:
        'Open any form’s Share tab, set a public path like `offer-a`, and optionally mark one form as the homepage for the root domain.',
      content: liveDomainBase ? (
        <div className="space-y-2 text-sm/6">
          <div className="rounded-xl border border-accent-light px-3 py-2">
            <div className="text-secondary text-xs uppercase tracking-[0.16em]">Root form</div>
            <div className="text-primary mt-1 break-all font-medium">{liveDomainBase}</div>
          </div>

          <div className="rounded-xl border border-accent-light px-3 py-2">
            <div className="text-secondary text-xs uppercase tracking-[0.16em]">Slug example</div>
            <div className="text-primary mt-1 break-all font-medium">{`${liveDomainBase}/offer-a`}</div>
          </div>

          {isLocalRuntime && localDomainBase && (
            <div className="rounded-xl border border-dashed border-accent-light px-3 py-2">
              <div className="text-secondary text-xs uppercase tracking-[0.16em]">Local preview</div>
              <div className="text-primary mt-1 break-all font-medium">{`${localDomainBase}/offer-a`}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-accent-light px-3 py-3 text-sm/6">
          <div className="text-secondary">Once the subdomain is saved, this step will show the root-form and slug examples.</div>
        </div>
      )
    }
  ]
  const activeWizardStep = wizardSteps[currentWizardStep]

  const { run: handleNameChange } = useRequest(
    async (name: string) => {
      const updates = {
        name
      }

      updateWorkspace(workspaceId, updates)
      await WorkspaceService.update(workspaceId, updates)
    },
    {
      debounceWait: 300,
      manual: true,
      refreshDeps: [workspaceId]
    }
  )

  const { run: handleAvatarChange } = useRequest(
    async (avatar?: string) => {
      const updates = {
        avatar
      }

      updateWorkspace(workspaceId, updates)
      await WorkspaceService.update(workspaceId, updates)
    },
    {
      manual: true,
      refreshDeps: [workspaceId]
    }
  )

  const { run: handleCustomDomainChange } = useRequest(
    async (domain?: string) => {
      const normalizedDomain = normalizeCustomDomain(domain)
      await WorkspaceService.addCustomDomain(workspaceId, normalizedDomain)
      updateWorkspace(workspaceId, {
        customDomain: normalizedDomain
      })
    },
    {
      debounceWait: 300,
      manual: true,
      refreshDeps: [workspaceId]
    }
  )

  return (
    <section id="general" className="border-accent-light border-b pb-10">
      <h2 className="hf-section-title">{t('settings.general.title')}</h2>

      <div className="mt-4 space-y-8">
        <div className="space-y-2">
          <label htmlFor="name" className="text-primary block text-sm/6 font-medium leading-6">
            {t('settings.general.name')}
          </label>
          <Input id="name" value={workspace?.name} onChange={handleNameChange} />
        </div>

        <div className="space-y-2">
          <div className="space-y-1">
            <label className="text-primary block text-sm font-medium leading-6">
              {t('settings.general.logo')}
            </label>
            <p data-slot="text" className="text-secondary text-base/5 sm:text-sm/5">
              {t('settings.general.pickLogo')}
            </p>
          </div>
          <ImageFormPicker
            value={workspace?.avatar}
            fallback={workspace?.name}
            resize={{
              width: 100,
              height: 100
            }}
            onChange={handleAvatarChange}
          />
        </div>

        <div className="space-y-2">
          <div className="space-y-1">
            <label htmlFor="custom-domain" className="text-primary block text-sm/6 font-medium leading-6">
              {t('form.share.link.useCustomDomain')}
            </label>
            <p data-slot="text" className="text-secondary text-base/5 sm:text-sm/5">
              Connect one client-facing subdomain here. The main client website stays untouched.
            </p>
          </div>
          <Input
            id="custom-domain"
            placeholder="forms.example.com"
            value={workspace?.customDomain || ''}
            disabled={!workspace?.isOwner}
            onChange={handleCustomDomainChange}
          />
        </div>

        <div className="border-accent-light rounded-2xl border p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-primary text-base/6 font-semibold">Custom domain wizard</h3>
              <p className="text-secondary mt-1 text-sm/6">
                Use a subdomain like `form.client.com`, then give each form a short path from its Share tab.
              </p>
            </div>

            {!workspace?.isOwner && (
              <div className="text-secondary rounded-full border border-current/15 px-3 py-1 text-xs font-medium">
                Owner only
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {wizardSteps.map((step, index) => (
              <button
                key={step.title}
                type="button"
                className={index === currentWizardStep
                  ? 'border-accent-light bg-foreground text-primary rounded-full border px-3 py-1.5 text-xs font-medium'
                  : 'border-accent-light text-secondary hover:text-primary rounded-full border px-3 py-1.5 text-xs font-medium transition-colors'}
                onClick={() => setCurrentWizardStep(index)}
              >
                {index + 1}. {step.title}
              </button>
            ))}
          </div>

          <div className="hf-card mt-5 rounded-2xl p-5">
            <div className="hf-label-muted">Step {currentWizardStep + 1} of {wizardSteps.length}</div>
            <div className="text-primary mt-2 text-lg/6 font-semibold">{activeWizardStep.title}</div>
            <p className="text-secondary mt-2 text-sm/6">{activeWizardStep.description}</p>

            <div className="mt-4">{activeWizardStep.content}</div>

            <div className="border-accent-light mt-5 flex items-center justify-between gap-3 border-t pt-4">
              <div className="text-secondary text-sm/6">
                {currentWizardStep === wizardSteps.length - 1
                  ? 'The custom-domain setup is ready. The next step is opening a form Share tab and setting its public path.'
                  : 'Continue to the next step when this one is complete.'}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {currentWizardStep > 0 && (
                  <Button.Ghost size="md" onClick={() => setCurrentWizardStep(step => step - 1)}>
                    {t('previous')}
                  </Button.Ghost>
                )}

                {currentWizardStep < wizardSteps.length - 1 && (
                  <Button size="md" onClick={() => setCurrentWizardStep(step => step + 1)}>
                    {t('next')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
