import { FieldLayoutAlignEnum, QUESTION_FIELD_KINDS } from '@neptunysform-inc/shared-types-enums'
import clsx from 'clsx'
import { FC, useEffect, useMemo, useRef, useState } from 'react'

import { questionNumber, removeHeading, replaceHTML } from '../utils'
import { htmlUtils } from '@neptunysform-inc/answer-utils'
import { helper } from '@neptunysform-inc/utils'

import { Layout } from '../components'
import { useStore } from '../store'
import type { IComponentProps, IFormField } from '../typings'

export interface BlockProps extends IComponentProps {
  field: IFormField
  paymentBlockIndex?: number
  isScrollable?: boolean
  transitionState?: 'active' | 'leaving'
}

const SPLIT_LAYOUTS = [
  FieldLayoutAlignEnum.FLOAT_LEFT,
  FieldLayoutAlignEnum.FLOAT_RIGHT,
  FieldLayoutAlignEnum.SPLIT_LEFT,
  FieldLayoutAlignEnum.SPLIT_RIGHT
]

const DEFAULT_BLOCK_FOCUS_DELAY_MS = 1000
const EMBEDDED_BLOCK_FOCUS_DELAY_MS = 240

function getBlockFocusDelayMs(isReducedMotion: boolean) {
  if (isReducedMotion) {
    return 0
  }

  if (typeof window === 'undefined') {
    return DEFAULT_BLOCK_FOCUS_DELAY_MS
  }

  try {
    return window.self !== window.top
      ? EMBEDDED_BLOCK_FOCUS_DELAY_MS
      : DEFAULT_BLOCK_FOCUS_DELAY_MS
  } catch {
    return EMBEDDED_BLOCK_FOCUS_DELAY_MS
  }
}

export const Block: FC<BlockProps> = ({
  className,
  field: rawField,
  paymentBlockIndex,
  isScrollable = true,
  transitionState = 'active',
  children,
  ...restProps
}) => {
  const { state } = useStore()
  const { values, fields, query, variables } = state
  const bodyRef = useRef<HTMLDivElement>(null)

  const field: IFormField = useMemo(
    () => ({
      ...rawField,
      title: replaceHTML(rawField.title as string, values, fields, query, variables),
      description: replaceHTML(rawField.description as string, values, fields, query, variables)
    }),
    [fields, query, rawField, values, variables]
  )

  const isInlineLayout = field.layout?.align === FieldLayoutAlignEnum.INLINE
  const isSplitLayout = SPLIT_LAYOUTS.includes(field.layout?.align as FieldLayoutAlignEnum)
  const inlineMediaPosition = field.layout?.inlineMediaPosition === 'top' ? 'top' : 'bottom'

  const [isReducedMotion, setIsReducedMotion] = useState(false)
  const [isTransitionReady, setIsTransitionReady] = useState(false)
  const activeFieldId = state.fields[state.scrollIndex!]?.id
  const isStandaloneActive =
    (!state.isStarted && state.welcomeField?.id === field.id) || !!state.isSubmitted
  const isLeaving = transitionState === 'leaving'
  const isActiveBlock = !isLeaving && (isStandaloneActive || field.id === activeFieldId)
  const transitionDirection = state.scrollTo === 'previous' ? 'previous' : 'next'
  const showQuestionNumber = state.settings?.enableQuestionNumbers !== false
  const stepLabel = useMemo(() => {
    const numberedLabel = questionNumber(field.number, field.parent?.number)

    if (numberedLabel) {
      return numberedLabel
    }

    if (!QUESTION_FIELD_KINDS.includes(field.kind)) {
      return ''
    }

    const questionFields = state.fields.filter(candidate => QUESTION_FIELD_KINDS.includes(candidate.kind))
    const questionIndex = questionFields.findIndex(candidate => candidate.id === field.id)

    return questionIndex > -1 ? String(questionIndex + 1) : ''
  }, [field.id, field.kind, field.number, field.parent?.number, state.fields])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setIsReducedMotion(false)
      return
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setIsReducedMotion(mediaQuery.matches)

    update()
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', update)
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(update)
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', update)
      } else if (typeof mediaQuery.removeListener === 'function') {
        mediaQuery.removeListener(update)
      }
    }
  }, [])

  useEffect(() => {
    if (
      helper.isValid(paymentBlockIndex) &&
      paymentBlockIndex !== state.scrollIndex &&
      !isLeaving
    ) {
      setIsTransitionReady(false)
      return
    }

    if (!isActiveBlock && !isLeaving) {
      return
    }

    if (isReducedMotion) {
      setIsTransitionReady(true)
      return
    }

    setIsTransitionReady(false)

    const timeoutId = window.setTimeout(() => {
      setIsTransitionReady(true)
    }, 10)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    isActiveBlock,
    isLeaving,
    isReducedMotion,
    paymentBlockIndex,
    state.scrollIndex,
    state.scrollTo
  ])

  useEffect(() => {
    if (!isActiveBlock || isLeaving) {
      return
    }

    const focusDelayMs = getBlockFocusDelayMs(isReducedMotion)

    const timeoutId = window.setTimeout(
      () => {
        const container = bodyRef.current

        if (!container) {
          return
        }

        const focusContainer = () => {
          try {
            container.focus({ preventScroll: true })
          } catch {
            container.focus()
          }
        }

        if (window.neptunysform.device.mobile) {
          focusContainer()
          return
        }

        const interactiveElement = container.querySelector<HTMLElement>(
          [
            '[data-neptunysform-focus-target]:not([disabled])',
            'input:not([type="hidden"]):not([disabled])',
            'textarea:not([disabled])',
            'select:not([disabled])',
            'button:not([disabled])',
            '[contenteditable="true"]',
            '[tabindex]:not([tabindex="-1"]):not([disabled])'
          ].join(',')
        )

        if (interactiveElement && interactiveElement.offsetParent !== null) {
          try {
            interactiveElement.focus({ preventScroll: true })
          } catch {
            interactiveElement.focus()
          }
          return
        }

        focusContainer()
      },
      focusDelayMs
    )

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [field.id, isActiveBlock, isLeaving, isReducedMotion, state.scrollIndex])

  return (
    <div
      ref={bodyRef}
      id={`neptunysform-${state.instanceId}-${field.id}`}
      className={clsx('neptunysform-body', {
        'neptunysform-body-split-layout': isSplitLayout,
        'neptunysform-body-active': isActiveBlock,
        'neptunysform-body-leaving': isLeaving
      })}
      tabIndex={isActiveBlock ? -1 : undefined}
      aria-hidden={!isActiveBlock}
    >
      {/* Theme background */}
      <div className="neptunysform-theme-background" />

      {/* Block container */}
      <div
        className={clsx('neptunysform-block-container', className)}
        {...restProps}
      >
        {field.parent && (
          <div className="neptunysform-block-group">
            <div className="neptunysform-block-group-container">
              <h2 className="neptunysform-block-title">
                {htmlUtils.plain(field.parent.title as string)}
              </h2>
            </div>
          </div>
        )}

        <div
          className={clsx('neptunysform-block', {
            [`neptunysform-block-direction-${transitionDirection}`]: transitionDirection,
            'neptunysform-block-entered': isTransitionReady && !isLeaving,
            'neptunysform-block-entering': !isTransitionReady && !isLeaving,
            'neptunysform-block-leaving': isLeaving,
            'neptunysform-block-leaving-active': isTransitionReady && isLeaving,
            'neptunysform-block-inactive':
              !isLeaving &&
              !isActiveBlock &&
              !isStandaloneActive &&
              !(helper.isValid(paymentBlockIndex) && paymentBlockIndex === state.scrollIndex),
            [`neptunysform-block-${field.layout?.align}`]: field.layout?.align
          })}
        >
          <div className="neptunysform-block-scroll">
            {/* Field layout */}
            {!isInlineLayout && <Layout {...field.layout} />}

            <div className="neptunysform-scroll-wrapper">
              <div className="neptunysform-scroll-container">
                <div className="neptunysform-block-main">
                  <div className="neptunysform-block-wrapper">
                    {isInlineLayout && inlineMediaPosition === 'top' && <Layout {...field.layout} />}

                    <div className="neptunysform-block-header">
                      {field.title && (
                        <div className="neptunysform-block-title-row">
                          {showQuestionNumber && stepLabel && (
                            <span className="neptunysform-question-step-chip">{stepLabel}</span>
                          )}
                          <h1
                            className="neptunysform-block-title"
                            dangerouslySetInnerHTML={{ __html: removeHeading(field.title as string) }}
                          />
                        </div>
                      )}
                      {field.description && (
                        <div
                          className="neptunysform-block-description"
                          dangerouslySetInnerHTML={{ __html: field.description as string }}
                        />
                      )}
                    </div>

                    {isInlineLayout && inlineMediaPosition === 'bottom' && <Layout {...field.layout} />}

                    {children}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
