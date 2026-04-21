import { IconBold, IconItalic, IconLink, IconUnderline, IconUnlink } from '@tabler/icons-react'
import type { CSSProperties, FC } from 'react'
import { startTransition, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getStyleFromRect } from './utils'
import { nextTick } from '@/utils'
import { helper } from '@neptunysform-inc/utils'

import { Button, ColorPicker, Form, Input, Portal, Select } from '@/components'

interface FloatingToolbarProps extends Omit<ComponentProps, 'onChange'> {
  visible?: boolean
  range?: Range
  onClose?: () => void
  onChange: () => void
}

interface ActiveState {
  isBold: boolean
  isItalic: boolean
  isStrikethrough: boolean
  isUnderline: boolean
  textColor?: string
  fontSizePx?: number
  link?: string
}

const FONT_SIZE_OPTIONS = [14, 16, 18, 20, 24, 28, 32].map(value => ({
  label: `${value}px`,
  value
}))

function getSelectionElement(sel: Selection | null) {
  const anchorNode = sel?.anchorNode

  if (!anchorNode) {
    return
  }

  return anchorNode instanceof Element ? anchorNode : anchorNode.parentElement || undefined
}

function getActiveState() {
  const state: ActiveState = {
    isBold: document.queryCommandState('bold'),
    isItalic: document.queryCommandState('italic'),
    isStrikethrough: document.queryCommandState('strikethrough'),
    isUnderline: document.queryCommandState('underline'),
    textColor: undefined,
    fontSizePx: undefined,
    link: undefined
  }

  const sel = window.getSelection()
  const element = getSelectionElement(sel)

  if (element) {
    const computedStyle = window.getComputedStyle(element)
    const fontSizePx = Math.round(parseFloat(computedStyle.fontSize))

    state.textColor = computedStyle.color
    state.fontSizePx = Number.isFinite(fontSizePx) ? fontSizePx : undefined
  }

  if (sel) {
    state.link = sel.anchorNode?.parentElement?.closest('a')?.href
  }

  return state
}

export const FloatingToolbar: FC<FloatingToolbarProps> = ({
  visible,
  range,
  onChange,
  onClose,
  ...restProps
}) => {
  const { t } = useTranslation()

  const [portalStyle, setPortalStyle] = useState<CSSProperties>()
  const [activeState, setActiveState] = useState({} as ActiveState)
  const [linkBubbleVisible, setLinkBubbleVisible] = useState(false)
  const activeFontSize = helper.isNumber(activeState.fontSizePx)
    ? FONT_SIZE_OPTIONS.find(option => option.value === activeState.fontSizePx)?.value
    : undefined

  function selectNodeContents(node: Node) {
    const sel = window.getSelection()

    if (!sel) {
      return
    }

    const newRange = document.createRange()
    newRange.selectNodeContents(node)
    sel.removeAllRanges()
    sel.addRange(newRange)
  }

  function applyInlineSpanStyle(style: Record<string, string>) {
    if (!range) {
      return
    }

    handleSelectRange()

    const sel = window.getSelection()

    if (!sel || sel.rangeCount < 1) {
      return
    }

    const activeRange = sel.getRangeAt(0)

    if (activeRange.collapsed) {
      return
    }

    const fragment = activeRange.extractContents()
    const wrapper = document.createElement('span')

    Object.entries(style).forEach(([key, value]) => {
      wrapper.style.setProperty(key, value, 'important')
    })

    wrapper.appendChild(fragment)
    activeRange.insertNode(wrapper)
    selectNodeContents(wrapper)

    nextTick(() => {
      setActiveState(getActiveState())
      onChange()
    })
  }

  function handleBold() {
    document.execCommand('bold')
    onChange()
  }

  function handleItalic() {
    document.execCommand('italic')
    onChange()
  }

  function handleUnderline() {
    document.execCommand('underline')
    onChange()
  }

  function handleTextColor(color: string) {
    applyInlineSpanStyle({
      color
    })
  }

  function handleFontSize(fontSizePx: number) {
    applyInlineSpanStyle({
      'font-size': `${fontSizePx}px`
    })
  }

  function handleLinkOpen() {
    setLinkBubbleVisible(true)
  }

  async function handleLink({ url }: any) {
    setLinkBubbleVisible(false)

    handleSelectRange()
    document.execCommand('createlink', false, url)

    startTransition(() => {
      setActiveState(getActiveState())
      onChange()
    })
  }

  function handleUnlink() {
    document.execCommand('unlink')

    nextTick(() => {
      setActiveState(getActiveState())
    })

    onChange()
  }

  function handleSelectRange() {
    const sel = window.getSelection()
    sel!.removeAllRanges()
    sel!.addRange(range!)

    return sel
  }

  useEffect(() => {
    if (helper.isValid(range) && range instanceof Range) {
      setPortalStyle(getStyleFromRect(range!.getBoundingClientRect()))
    }
  }, [range])

  useEffect(() => {
    if (visible) {
      setActiveState(getActiveState())
    }

    setLinkBubbleVisible(false)

    return () => {
      setActiveState({} as ActiveState)
    }
  }, [visible])

  return (
    <Portal visible={visible}>
      <div className="floating-toolbar">
        <div className="floating-toolbar-mask" onClick={onClose} />
        <div
          data-rich-text-toolbar="true"
          className="floating-toolbar-container bg-foreground flex items-center rounded-md px-2 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
          style={portalStyle}
          {...restProps}
        >
          {linkBubbleVisible ? (
            <Form.Simple
              className="flex items-center gap-x-1.5 [&_[data-slot=control]]:space-y-0"
              initialValues={{
                url: activeState.link
              }}
              submitProps={{
                label: t('components.apply'),
                size: 'sm'
              }}
              fetch={handleLink}
              submitOnChangedOnly
            >
              <Form.Item name="url" rules={[{ required: true }]}>
                <Input
                  className="[&_[data-slot=input]]:p-1"
                  placeholder={t('form.builder.compose.pasteLink')}
                />
              </Form.Item>
            </Form.Simple>
          ) : (
            <>
              <Button.Link
                size="sm"
                className="text-secondary hover:text-primary"
                iconOnly
                onClick={handleBold}
              >
                <IconBold className="h-5 w-5" />
              </Button.Link>
              <Button.Link
                size="sm"
                className="text-secondary hover:text-primary"
                iconOnly
                onClick={handleItalic}
              >
                <IconItalic className="h-5 w-5" />
              </Button.Link>
              <Button.Link
                size="sm"
                className="text-secondary hover:text-primary"
                iconOnly
                onClick={handleUnderline}
              >
                <IconUnderline className="h-5 w-5" />
              </Button.Link>
              <Button.Link
                size="sm"
                className="text-secondary hover:text-primary"
                iconOnly
                onClick={handleLinkOpen}
              >
                <IconLink className="h-5 w-5" />
              </Button.Link>
              {activeState.link && (
                <Button.Link
                  size="sm"
                  className="text-secondary hover:text-primary"
                  iconOnly
                  onClick={handleUnlink}
                >
                  <IconUnlink className="h-5 w-5" />
                </Button.Link>
              )}

              <Select
                className="ml-1 w-[5.75rem]"
                type="number"
                value={activeFontSize}
                options={FONT_SIZE_OPTIONS}
                placeholder="Size"
                contentProps={{
                  side: 'bottom',
                  align: 'end'
                }}
                onChange={value => {
                  if (helper.isNumber(value)) {
                    handleFontSize(value)
                  }
                }}
              />

              <div className="ml-1">
                <ColorPicker
                  value={activeState.textColor || '#ffffff'}
                  contentProps={{
                    side: 'bottom',
                    align: 'end'
                  }}
                  onChange={handleTextColor}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </Portal>
  )
}
