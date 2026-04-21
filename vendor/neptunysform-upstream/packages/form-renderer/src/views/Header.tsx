import type { FC } from 'react'
import { useCallback } from 'react'

import { sendMessageToParent } from '../utils'
import { helper } from '@neptunysform-inc/utils'

import { Countdown } from '../components/Countdown'
import { useStore } from '../store'
import { Progress, TopProgressBar } from './Progress'

interface HeaderProps {
  showStatus?: boolean
}

export const Header: FC<HeaderProps> = ({ showStatus = true }) => {
  const { state, dispatch } = useStore()
  const progressStyle = (state.settings as Record<string, any> | undefined)?.progressStyle
  const showTopProgress =
    showStatus && !!state.settings?.enableProgress && progressStyle === 'top-bar'
  const showCircularProgress =
    showStatus && !!state.settings?.enableProgress && progressStyle !== 'top-bar'

  async function handleCountdownEnd() {
    // Submit form
    await state.onSubmit?.(state.values, true)

    if (helper.isTrue(state.query.hideAfterSubmit)) {
      sendMessageToParent('HIDE_EMBED_MODAL')
    }

    dispatch({
      type: 'setIsSubmitted',
      payload: {
        isSubmitted: true
      }
    })
  }

  const handleCountdownEndCallback = useCallback(handleCountdownEnd, [state.values])

  return (
    <div className="neptunysform-header">
      {showTopProgress && <TopProgressBar />}

      <div className="neptunysform-header-wrapper">
        <div className="neptunysform-header-left">
          {state.logo && (
            <div className="neptunysform-logo">
              <img src={state.logo} alt="" />
            </div>
          )}
        </div>

        <div className="neptunysform-header-right">
          {showStatus && state.settings?.enableTimeLimit && state.settings.timeLimit && (
            <Countdown settings={state.settings!} onEnd={handleCountdownEndCallback} />
          )}
          {showCircularProgress && <Progress />}
        </div>
      </div>
    </div>
  )
}
