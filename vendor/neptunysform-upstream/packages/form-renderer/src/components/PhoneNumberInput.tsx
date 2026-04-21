import type { PhoneNumber } from 'libphonenumber-js'
import {
  formatIncompletePhoneNumber,
  parsePhoneNumber
} from 'libphonenumber-js'
import type { FC } from 'react'
import { startTransition, useCallback, useEffect, useMemo, useState } from 'react'

import { helper } from '@neptunysform-inc/utils'

import { COUNTRIES } from '../consts'
import { CountrySelect } from './CountrySelect'
import { Input } from './Input'

interface PhoneNumberInputProps {
  value?: string
  name?: string
  autoComplete?: string
  defaultCountryCode?: string
  hideCountrySelect?: boolean
  onDropdownVisibleChange?: (visible: boolean) => void
  onChange?: (value: string) => void
}

function format(input: string, countryCode: string) {
  return formatIncompletePhoneNumber(input, countryCode as any)
}

function parse(input: string, countryCode: string): PhoneNumber | undefined {
  try {
    return parsePhoneNumber(input, countryCode as any)
  } catch (_) {}
}

function normalizeLeadingZeroPhoneNumber(input: string, countryCode: string) {
  const parsed = parse(input, countryCode)

  if (parsed?.isValid()) {
    return parsed
  }

  const trimmedInput = input.trim()

  if (!trimmedInput || trimmedInput.startsWith('+') || !trimmedInput.startsWith('0')) {
    return parsed
  }

  const digitsOnly = trimmedInput.replace(/\D/g, '')

  if (digitsOnly.length <= 1 || !digitsOnly.startsWith('0')) {
    return parsed
  }

  const normalized = parse(digitsOnly.slice(1), countryCode)

  return normalized?.isValid() ? normalized : parsed
}

function getSubmittedValue(input: string, countryCode: string) {
  return normalizeLeadingZeroPhoneNumber(input, countryCode)?.number || ''
}

export const PhoneNumberInput: FC<PhoneNumberInputProps> = ({
  name,
  autoComplete,
  defaultCountryCode = 'US',
  hideCountrySelect = false,
  value: rawValue = '',
  onDropdownVisibleChange,
  onChange
}) => {
  const [value, setValue] = useState<string>()
  const [countryCode, setCountryCode] = useState(defaultCountryCode)
  const selectedCountry = useMemo(
    () =>
      COUNTRIES.find(c => c.value === countryCode) ||
      COUNTRIES.find(c => c.value === defaultCountryCode) ||
      COUNTRIES.find(c => c.value === 'US'),
    [countryCode, defaultCountryCode]
  )

  const placeholder = useMemo(() => selectedCountry?.example, [selectedCountry])

  function handleCodeChange(newCountryCode: any) {
    setCountryCode(newCountryCode)

    if (helper.isValid(value)) {
      const newValue = format(value!, newCountryCode)
      setValue(newValue)

      onChange?.(getSubmittedValue(newValue, newCountryCode))
    }
  }

  function handleInputChange(inputValue: string) {
    let newCountryCode = hideCountrySelect ? defaultCountryCode : countryCode
    const parsed = parse(inputValue, newCountryCode)

    if (
      !hideCountrySelect &&
      helper.isValid(parsed?.country) &&
      parsed!.country! !== countryCode
    ) {
      newCountryCode = parsed!.country!
      setCountryCode(newCountryCode)
    }

    let newValue = format(inputValue, newCountryCode)

    // Fork from https://github.com/catamphetamine/react-phone-number-input/blob/master/source/InputBasic.js#L27
    // By default, if a value is something like `"(123)"`
    // then Backspace would only erase the rightmost brace
    // becoming something like `"(123"`
    // which would give the same `"123"` value
    // which would then be formatted back to `"(123)"`
    // and so a user wouldn't be able to erase the phone number.
    // Working around this issue with this simple hack.
    if (newValue === value) {
      const formatted = format(newValue, newCountryCode)

      if (formatted.indexOf(inputValue) === 0) {
        // Trim the last digit (or plus sign).
        newValue = newValue.slice(0, -1)
      }
    }

    setValue(newValue)

    startTransition(() => {
      onChange?.(getSubmittedValue(newValue, newCountryCode))
    })
  }

  const handleCodeChangeCallback = useCallback(handleCodeChange, [onChange, value])
  const handleInputChangeCallback = useCallback(handleInputChange, [
    countryCode,
    defaultCountryCode,
    hideCountrySelect,
    onChange,
    value
  ])

  useEffect(() => {
    if (hideCountrySelect) {
      setCountryCode(defaultCountryCode)
    }

    const parsed = normalizeLeadingZeroPhoneNumber(rawValue, defaultCountryCode)

    if (parsed) {
      const { country, nationalNumber } = parsed
      const nextCountryCode = hideCountrySelect ? defaultCountryCode : country || defaultCountryCode
      const newValue = format(nationalNumber! as string, nextCountryCode)

      setValue(newValue)
      setCountryCode(nextCountryCode)
      return
    }

    if (!rawValue) {
      setValue('')
      setCountryCode(defaultCountryCode)
    }
  }, [defaultCountryCode, hideCountrySelect, rawValue])

  return (
    <div className="flex items-center">
      {!hideCountrySelect && (
        <CountrySelect
          popupClassName="neptunysform-phone-number-popup"
          enableLabel={false}
          enableCallingCode={true}
          allowClear={false}
          value={countryCode}
          onDropdownVisibleChange={onDropdownVisibleChange}
          onChange={handleCodeChangeCallback}
        />
      )}
      <Input
        name={name}
        autoComplete={autoComplete}
        type="tel"
        value={value}
        placeholder={placeholder}
        onChange={handleInputChangeCallback}
      />
    </div>
  )
}
