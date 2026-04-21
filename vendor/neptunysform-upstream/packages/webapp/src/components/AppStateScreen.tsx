import type { FC } from 'react'

import { cn } from '@/utils'

import { Loader } from './Loader'

interface AppStateScreenProps extends ComponentProps {
  title: string
  message?: string
  status?: 'loading' | 'error'
}

export const AppStateScreen: FC<AppStateScreenProps> = ({
  className,
  title,
  message,
  status = 'loading',
  ...restProps
}) => {
  const isLoading = status === 'loading'

  return (
    <div
      className={cn('dark bg-background text-primary flex min-h-screen items-center justify-center p-6 sm:p-10', className)}
      {...restProps}
    >
      <div className="border-accent-light bg-foreground w-full max-w-xl rounded-[1.75rem] border px-6 py-8 shadow-2xl shadow-black/20 sm:px-8 sm:py-10">
        <div className="flex items-center gap-3">
          <span className="bg-accent-light text-primary inline-flex h-10 w-10 items-center justify-center rounded-xl">
            {isLoading ? <Loader className="h-5 w-5 animate-spin" /> : <span className="h-2.5 w-2.5 rounded-full bg-current" />}
          </span>

          <div className="text-secondary text-xs font-medium uppercase tracking-[0.18em]">
            {isLoading ? 'Loading' : 'Notice'}
          </div>
        </div>

        <h1 className="text-primary mt-5 text-balance text-2xl/8 font-semibold sm:text-3xl/9">{title}</h1>

        {message && <p className="text-secondary mt-3 max-w-lg text-sm/6 sm:text-base/7">{message}</p>}
      </div>
    </div>
  )
}