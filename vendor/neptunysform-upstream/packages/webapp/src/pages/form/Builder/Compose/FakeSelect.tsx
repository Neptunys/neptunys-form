import { IconChevronDown } from '@tabler/icons-react'
import type { FC } from 'react'

export const FakeSelect: FC<ComponentProps & { placeholder?: string }> = ({
  placeholder,
  ...restProps
}) => {
  return (
    <div className="neptunysform-select" {...restProps}>
      <div className="neptunysform-select-container">
        {/* @ts-ignore */}
        <span className="neptunysform-select-value" placeholder={placeholder} />
        <span className="neptunysform-select-arrow-icon">
          <IconChevronDown />
        </span>
      </div>
    </div>
  )
}
