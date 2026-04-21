import type { FC, ReactNode } from 'react'

interface FakeSubmitProps extends ComponentProps {
  text?: string
  icon?: ReactNode
  helper?: ReactNode
}

export const FakeSubmit: FC<FakeSubmitProps> = ({ text, icon, helper, ...restProps }) => {
  return (
    <div
      {...restProps}
      className={[
        'neptunysform-submit-container',
        restProps.className
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="neptunysform-submit-button">
        <span>{text}</span>
        {icon}
      </div>
      {helper}
    </div>
  )
}
