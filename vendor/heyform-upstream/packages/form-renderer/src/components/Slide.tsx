import clsx from 'clsx'
import type { FC } from 'react'

import { IComponentProps } from '../typings'

interface SlideProps extends Omit<IComponentProps, 'onChange'> {
  index: number
  count: number
  onChange: (scrollIndex: number, scrollTo: 'next' | 'previous') => void
}

// Global Timeout
const timeout = new Timeout()

export const Slide: FC<SlideProps> = ({
  className,
  children,
  ...restProps
}) => {
  return <div className={clsx('heyform-slide', className)} {...restProps}>{children}</div>
}
