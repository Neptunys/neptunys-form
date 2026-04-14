import FullNameSettings from './FullName'
import PhoneNumberSettings from './PhoneNumber'
import { RequiredSettingsProps } from './Required'

export default function ContactInfoSettings({ field }: RequiredSettingsProps) {
  return (
    <div className="space-y-3">
      <FullNameSettings field={field} />
      <PhoneNumberSettings field={field} />
    </div>
  )
}