import type { FC, ReactNode } from 'react'

interface FakeSubmitProps extends ComponentProps {
  text?: string
  icon?: ReactNode
  helper?: ReactNode
}

export const FakeSubmit: FC<FakeSubmitProps> = ({ text, icon, helper, ...restProps }) => {
  return (
    <div className="heyform-submit-container" {...restProps}>
      <div className="heyform-submit-button">
        <span>{text}</span>
        {icon}
      </div>
      {helper}
    </div>
  )
}
