import type { FC } from 'react'
import { useCallback } from 'react'

import { sendMessageToParent } from '../utils'
import { helper } from '@heyform-inc/utils'

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
    <div className="heyform-header">
      {showTopProgress && <TopProgressBar />}

      <div className="heyform-header-wrapper">
        <div className="heyform-header-left">
          {state.logo && (
            <div className="heyform-logo">
              <img src={state.logo} alt="" />
            </div>
          )}
        </div>

        <div className="heyform-header-right">
          {showStatus && state.settings?.enableTimeLimit && state.settings.timeLimit && (
            <Countdown settings={state.settings!} onEnd={handleCountdownEndCallback} />
          )}
          {showCircularProgress && <Progress />}
        </div>
      </div>
    </div>
  )
}
