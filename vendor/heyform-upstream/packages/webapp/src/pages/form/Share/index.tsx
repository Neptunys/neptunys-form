import {
  IconBrandFacebook,
  IconBrandLinkedin,
  IconBrandX,
  IconExclamationCircle,
  IconMail,
  IconQrcode
} from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { buildPublicFormUrl, buildTrackedShareUrl, getDecoratedURL, TRAFFIC_SOURCE_PRESETS, useParam } from '@/utils'

import { Button, Input, Select, Tooltip } from '@/components'
import { FORM_EMBED_OPTIONS } from '@/consts'
import { useAppStore, useFormStore, useWorkspaceStore } from '@/store'

import EmbedModal from './EmbedModal'
import LinkSettings from './LinkSettings'
import QRCodeModal from './QRCodeModal'

export default function FormShare() {
  const { t } = useTranslation()

  const { formId } = useParam()
  const { openModal } = useAppStore()
  const { sharingURLPrefix, workspace } = useWorkspaceStore()
  const { form, selectEmbedType } = useFormStore()
  const [sourcePreset, setSourcePreset] = useState(TRAFFIC_SOURCE_PRESETS[0].value)
  const [campaign, setCampaign] = useState('military_quiz')

  const shareLink = useMemo(
    () =>
      buildPublicFormUrl({
        sharingURLPrefix,
        formId,
        slug: form?.slug,
        isDomainRoot: form?.isDomainRoot,
        customDomain: workspace?.customDomain
      }),
    [form?.isDomainRoot, form?.slug, formId, sharingURLPrefix, workspace?.customDomain]
  )

  const sourceOptions = useMemo(
    () => TRAFFIC_SOURCE_PRESETS.map(option => ({ value: option.value, label: option.label })),
    []
  )

  const trackedShareLink = useMemo(() => {
    const preset = TRAFFIC_SOURCE_PRESETS.find(option => option.value === sourcePreset)

    return buildTrackedShareUrl(shareLink, preset, campaign)
  }, [campaign, shareLink, sourcePreset])

  function handleShareEmail() {
    const url = getDecoratedURL('mailto:', {
      subject: 'Could you take a moment to fill in this NeptunysForm page?',
      body: `We would really appreciate it if you filled in this form: ${shareLink}. Thank you.`
    })
    window.open(url)
  }

  function handleShareFacebook() {
    const url = getDecoratedURL('https://www.facebook.com/sharer/sharer.php', {
      u: shareLink
    })
    window.open(url)
  }

  function handleShareLinkedin() {
    const url = getDecoratedURL('https://www.linkedin.com/sharing/share-offsite', {
      url: shareLink
    })
    window.open(url)
  }

  function handleShareTwitter() {
    const url = getDecoratedURL('https://twitter.com/share', {
      url: shareLink,
      title: form?.name || ''
    })
    window.open(url)
  }

  function handleShareQrcode() {
    openModal('QRCodeModal', {
      url: shareLink
    })
  }

  function handleOpenEmbed(embedType: string) {
    selectEmbedType(embedType)
    openModal('EmbedModal')
  }

  return (
    <>
      <div className="mt-10 space-y-10 px-6">
        {form?.canPublish && (
          <div className="border-accent-light flex items-center justify-center gap-x-2 rounded-lg border bg-red-50 py-2">
            <IconExclamationCircle className="h-5 w-5 text-red-700" />
            <span className="text-sm/6 font-medium text-red-700">
              {t('form.share.unpublishedTip')}
            </span>
          </div>
        )}

        <section id="link">
          <h2 className="hf-section-title">{t('form.share.link.headline')}</h2>
          <div className="mt-4">
            <div className="flex flex-col gap-2 text-sm/6 sm:flex-row sm:items-center">
              <div className="hf-card border-input flex items-center gap-x-4 rounded-lg border">
                <div className="h-10 flex-1 truncate pl-4 leading-10">{shareLink}</div>
                <Button.Copy className="rounded-l-none" text={shareLink} />
              </div>
            </div>

            <div className="mt-4 space-y-2 rounded-lg border border-accent-light p-3">
              <div className="text-secondary text-xs font-medium uppercase tracking-wide">
                Source link generator
              </div>

              <div className="grid gap-2 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
                <Select
                  value={sourcePreset}
                  options={sourceOptions}
                  placeholder="Select source"
                  onChange={setSourcePreset}
                />

                <Input
                  value={campaign}
                  placeholder="Campaign name"
                  onChange={setCampaign}
                />
              </div>

              <div className="hf-card border-input flex items-center gap-x-4 rounded-lg border">
                <div className="h-10 flex-1 truncate pl-4 leading-10">{trackedShareLink}</div>
                <Button.Copy className="rounded-l-none" text={trackedShareLink} />
              </div>
            </div>

            <div className="mt-2 flex items-center gap-x-2">
              <Tooltip label={t('form.share.link.viaX')}>
                <div>
                  <Button.Link size="md" iconOnly onClick={handleShareTwitter}>
                    <IconBrandX className="h-5 w-5" />
                  </Button.Link>
                </div>
              </Tooltip>

              <Tooltip label={t('form.share.link.viaFacebook')}>
                <div>
                  <Button.Link size="md" iconOnly onClick={handleShareFacebook}>
                    <IconBrandFacebook className="h-5 w-5" />
                  </Button.Link>
                </div>
              </Tooltip>

              <Tooltip label={t('form.share.link.viaLinkedIn')}>
                <div>
                  <Button.Link size="md" iconOnly onClick={handleShareLinkedin}>
                    <IconBrandLinkedin className="h-5 w-5" />
                  </Button.Link>
                </div>
              </Tooltip>

              <Tooltip label={t('form.share.link.email.title')}>
                <div>
                  <Button.Link size="md" iconOnly onClick={handleShareEmail}>
                    <IconMail className="h-5 w-5" />
                  </Button.Link>
                </div>
              </Tooltip>

              <Tooltip label={t('form.share.link.qrcode.title')}>
                <div>
                  <Button.Link size="md" iconOnly onClick={handleShareQrcode}>
                    <IconQrcode className="h-5 w-5" />
                  </Button.Link>
                </div>
              </Tooltip>
            </div>
          </div>
        </section>

        <LinkSettings />

        <section id="embed">
          <h2 className="hf-section-title">{t('form.share.embed.headline')}</h2>
          <p className="text-secondary text-sm/6">{t('form.share.embed.subHeadline')}</p>

          <div className="mt-4 flex gap-4 sm:gap-8">
            {FORM_EMBED_OPTIONS.map(row => (
              <button
                key={row.value}
                type="button"
                tabIndex={-1}
                className="text-secondary hover:text-primary w-32 text-sm/6"
                onClick={() => handleOpenEmbed(row.value)}
              >
                <div className="border-input rounded-md border">
                  <row.icon className="w-full rounded-md" />
                </div>
                <div className="mt-1.5 text-center">{t(row.label)}</div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <QRCodeModal />
      <EmbedModal />
    </>
  )
}
