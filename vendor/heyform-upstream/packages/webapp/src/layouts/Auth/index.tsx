import { LayoutProps } from '@heyooo-inc/react-router'
import { FC, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { helper } from '@heyform-inc/utils'

import brandLogo from '@/assets/neptunys-logo.png'

import LanguageSwitcher from './LanguageSwitcher'

const APP_NAME = 'NeptunysForm'

export const AuthLayout: FC<LayoutProps> = ({ options, children }) => {
  const { t } = useTranslation()

  useEffect(() => {
    const root = document.documentElement
    const hadDarkClass = root.classList.contains('dark')

    if (!hadDarkClass) {
      root.classList.add('dark')
    }

    if (helper.isValid(options?.title)) {
      document.title = `${t(options!.title)} - ${APP_NAME}`
    }

    return () => {
      if (!hadDarkClass) {
        root.classList.remove('dark')
      }
    }
  }, [options, t])

  return (
    <div className="dark bg-foreground text-primary flex min-h-screen flex-col">
      <div className="bg-foreground sticky top-0 flex items-center justify-between p-4">
        <a href="/" className="flex items-center gap-1" title={APP_NAME}>
          <img src={brandLogo} alt={APP_NAME} className="-mr-1 h-8 w-auto object-contain" />
          <span className="text-xl font-medium">{APP_NAME}</span>
        </a>

        <LanguageSwitcher />
      </div>

      <div className="flex flex-1 flex-col justify-center p-4 lg:p-12">{children}</div>
    </div>
  )
}
