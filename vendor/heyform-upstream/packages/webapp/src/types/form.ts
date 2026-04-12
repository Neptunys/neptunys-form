import { FormField, FormModel, Property } from '@heyform-inc/shared-types-enums'

import { APP_STATUS_ENUM } from '@/consts'

export interface AppSettingOptionType {
  label: string
  value: string
  disabled?: boolean
}

export interface AppSettingType {
  type: string
  name: string
  label: string
  description?: string
  placeholder?: string
  options?: AppSettingOptionType[]
  defaultValue?: any
  required: boolean
}

export interface AppType {
  id: string
  name: string
  description?: string
  icon?: string
  settings?: AppSettingType[]
  status?: APP_STATUS_ENUM
}

export interface IntegratedAppType extends AppType {
  integration: IntegrationType
  isAuthorized?: boolean
}

export interface IntegrationType {
  appId: string
  config?: AnyMap
  status: number
  lastDeliveryAt?: number
  lastDeliveryStatus?: string
  lastDeliveryMessage?: string
}

export interface FormQuestionAnalyticType {
  questionId: string
  order: number
  title?: string
  reachCount: number
  reachRate: number
  averageDuration: number
  completedCount: number
  dropOffCount: number
  dropOffRate: number
  frictionScore: number
  frictionLevel: string
}

export interface ExperimentVariantType {
  formId: string
  weight: number
}

export interface ExperimentVariantMetricType extends ExperimentVariantType {
  visits: number
  submissions: number
  conversionRate: number
  averageTime: number
  isWinner: boolean
  meetsMinimumSample?: boolean
  minimumSampleGap?: number
}

export interface ExperimentType {
  id: string
  teamId: string
  projectId: string
  name: string
  status: string
  primaryMetric: string
  autoPromote: boolean
  durationHours: number
  minimumSampleSize: number
  minimumSampleReached?: boolean
  promotionBlockedReason?: string
  startAt: number
  endAt: number
  winnerFormId?: string
  promotedAt?: number
  variants: ExperimentVariantType[]
  metrics?: ExperimentVariantMetricType[]
}

export interface PublicRouteType {
  kind: 'form' | 'experiment'
  formId?: string
  experimentId?: string
  projectId?: string
}

export interface PublicExperimentType {
  experimentId: string
  formId: string
  winnerFormId?: string
}

export interface PublicFormType extends FormModel {
  slug?: string
  isDomainRoot?: boolean
  integrations?: Record<string, string>
}

export interface FormFieldType extends FormField {
  isCollapsed?: boolean
  parent?: FormFieldType
  properties?: Omit<Property, 'fields'> & {
    fields?: FormField[]
  }
}

export interface TemplateType extends FormModel {
  category: string
  recordId?: string
}

export interface TemplateGroupType {
  id: string
  category: string
  templates: TemplateType[]
}

export interface ChatMessageType {
  id: string
  type: 'text' | 'notification'
  content: string
  isUser?: boolean
}
