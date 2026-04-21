import type { FC } from 'react'

interface FakeRadioProps extends ComponentProps {
  hotkey?: string
  label: string | number
}

export const FakeRadio: FC<FakeRadioProps> = ({ hotkey, label, ...restProps }) => {
  return (
    <div className="neptunysform-radio" {...restProps}>
      <div className="neptunysform-radio-container">
        <div className="neptunysform-radio-content">
          {hotkey && <div className="neptunysform-radio-hotkey">{hotkey}</div>}
          <div className="neptunysform-radio-label">{label}</div>
        </div>
      </div>
    </div>
  )
}
