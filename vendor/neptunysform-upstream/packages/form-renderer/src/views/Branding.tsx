import { FC } from 'react'

export const Branding: FC = () => {
  return null
}

export const WelcomeBranding: FC = () => {
  return (
    <div className="neptunysform-footer neptunysform-welcome-footer">
      <div className="neptunysform-footer-wrapper">
        <div className="neptunysform-footer-left" />
        <div className="neptunysform-footer-right">
          <Branding />
        </div>
      </div>
    </div>
  )
}
