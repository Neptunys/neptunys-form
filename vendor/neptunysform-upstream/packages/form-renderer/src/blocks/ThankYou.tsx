import { IconArrowUpRight, IconCheck, IconClockHour4, IconShare3 } from '@tabler/icons-react'
import clsx from 'clsx'
import type { FC } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { isURL, useTranslation } from '../utils'

import { useStore } from '../store'
import { WelcomeBranding } from '../views/Branding'
import { Header } from '../views/Header'
import type { BlockProps } from './Block'
import { Block } from './Block'

function normalizeUrl(url: string) {
  return isURL(url) ? url : `https://${url}`
}

function formatCompletionTime(totalMs: number) {
  const totalSeconds = Math.max(0, Math.round(totalMs / 1_000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes > 59) {
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return `${hours}h ${String(remainingMinutes).padStart(2, '0')}m`
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export const ThankYou: FC<BlockProps> = ({ field, className, children, ...restProps }) => {
  const { state } = useStore()
  const { t } = useTranslation()
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'shared'>('idle')
  const hasReportedVisibleRef = useRef(false)
  const buttonLinkUrl = useMemo(
    () =>
      typeof field.properties?.buttonLinkUrl === 'string' && field.properties.buttonLinkUrl
        ? normalizeUrl(field.properties.buttonLinkUrl)
        : undefined,
    [field.properties?.buttonLinkUrl]
  )
  const completionTime = useMemo(() => {
    if (!field.properties?.enableCompleteTime || !state.startedAt || !state.submittedAt) {
      return undefined
    }

    return formatCompletionTime(Math.max(0, state.submittedAt - state.startedAt))
  }, [field.properties?.enableCompleteTime, state.startedAt, state.submittedAt])
  const primaryActionText =
    field.properties?.buttonText ||
    (buttonLinkUrl ? t('Continue') : t('Submit another response'))
  const showPrimaryAction = Boolean(field.properties?.buttonText || buttonLinkUrl)
  const showResponsePanel = field.properties?.showResponsePanel !== false

  useEffect(() => {
    if (hasReportedVisibleRef.current) {
      return
    }

    hasReportedVisibleRef.current = true
    state.onThankYouVisible?.()
  }, [state.onThankYouVisible])

  useEffect(() => {
    let redirectUrl = field.properties?.redirectUrl

    if (state.customUrlRedirects && field.properties?.redirectOnCompletion && redirectUrl) {
      const delay = (field.properties?.redirectDelay || 0) * 1_000

      if (!isURL(redirectUrl)) {
        redirectUrl = 'https://' + redirectUrl
      }

      const timeoutId = window.setTimeout(() => {
        window.location.href = redirectUrl as string
      }, delay)

      return () => {
        window.clearTimeout(timeoutId)
      }
    }
  }, [
    field.properties?.redirectDelay,
    field.properties?.redirectOnCompletion,
    field.properties?.redirectUrl,
    state.customUrlRedirects
  ])

  useEffect(() => {
    if (shareState === 'idle') {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setShareState('idle')
    }, 2200)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [shareState])

  async function handleShare() {
    const shareUrl = window.location.href

    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: typeof field.title === 'string' ? field.title : undefined,
          text: typeof field.description === 'string' ? field.description : undefined,
          url: shareUrl
        })
        setShareState('shared')
        return
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
        setShareState('copied')
      }
    } catch {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl).then(() => {
          setShareState('copied')
        })
      }
    }
  }

  function handlePrimaryAction() {
    if (buttonLinkUrl) {
      window.location.href = buttonLinkUrl
      return
    }

    window.location.reload()
  }

  const completionTimeContent = completionTime && (
    <div
      className={clsx('neptunysform-thank-you-meta', {
        'neptunysform-thank-you-meta-standalone': !showResponsePanel
      })}
    >
      <span className="neptunysform-thank-you-meta-item">
        <IconClockHour4 />
        <span>{t('Completed in {{time}}', { time: completionTime })}</span>
      </span>
    </div>
  )

  const actionButtons = (showPrimaryAction || field.properties?.enableShareIcon) && (
    <div
      className={clsx('neptunysform-thank-you-actions', {
        'neptunysform-thank-you-actions-standalone': !showResponsePanel
      })}
    >
      {showPrimaryAction && (
        <button
          className="neptunysform-thank-you-primary"
          type="button"
          onClick={handlePrimaryAction}
        >
          <span>{primaryActionText}</span>
          {buttonLinkUrl && <IconArrowUpRight />}
        </button>
      )}

      {field.properties?.enableShareIcon && (
        <button
          className="neptunysform-thank-you-secondary"
          type="button"
          onClick={handleShare}
        >
          <IconShare3 />
          <span>
            {shareState === 'copied'
              ? t('Link copied')
              : shareState === 'shared'
                ? t('Shared')
                : t('Share form')}
          </span>
        </button>
      )}
    </div>
  )

  return (
    <>
      <Header showStatus={false} />
      <Block
        className={clsx('neptunysform-empty-state neptunysform-thank-you', className)}
        field={field}
        isScrollable={false}
        {...restProps}
      >
        {showResponsePanel && (
          <div className="neptunysform-thank-you-panel">
            <div className="neptunysform-thank-you-celebration" aria-hidden="true">
              <span className="neptunysform-thank-you-ring" />
              <span className="neptunysform-thank-you-check">
                <IconCheck />
              </span>
              <span className="neptunysform-thank-you-burst neptunysform-thank-you-burst-1" />
              <span className="neptunysform-thank-you-burst neptunysform-thank-you-burst-2" />
              <span className="neptunysform-thank-you-burst neptunysform-thank-you-burst-3" />
              <span className="neptunysform-thank-you-burst neptunysform-thank-you-burst-4" />
            </div>

            <div className="neptunysform-thank-you-kicker">{t('Response recorded')}</div>

            {completionTimeContent}
            {actionButtons}
          </div>
        )}

        {!showResponsePanel && completionTimeContent}
        {!showResponsePanel && actionButtons}
      </Block>
      <WelcomeBranding />
    </>
  )
}
