import { FormModel, FormTheme } from '@neptunysform-inc/shared-types-enums'

import { FormType } from '@/types/index.ts'

import { UserType } from './user'

export interface ProjectType {
  id: string
  teamId: string
  name: string
  ownerId: string
  icon?: string
  launchPath?: string
  launchMode?: 'form' | 'experiment'
  launchFormId?: string
  launchExperimentId?: string
  leadNotificationEmails?: string[]
  leadReportEmails?: string[]
  enableRespondentNotification?: boolean
  respondentNotificationSubject?: string
  respondentNotificationMessage?: string
  respondentNegativeNotificationSubject?: string
  respondentNegativeNotificationMessage?: string
  enableLeadReport?: boolean
  leadReportFrequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly'
  leadReportRangeDays?: number
  leadReportSubject?: string
  leadReportMessage?: string
  leadReportLastSentAt?: number
  reportingTimezone?: string
  enableGoogleSheetsLeadSync?: boolean
  googleSheetsLeadConfig?: AnyMap
  googleSheetsLeadLastDeliveryAt?: number
  googleSheetsLeadLastDeliveryStatus?: string
  googleSheetsLeadLastDeliveryMessage?: string
  formCount: number
  isOwner?: boolean
  members: string[]
  forms: FormModel
}

export interface ProjectLaunchOverviewType {
  projectId: string
  formCount: number
  publishedFormCount: number
  experimentCount: number
  runningExperimentCount: number
  leadCount30d: number
  highPriorityLeadCount30d: number
  lastLeadAt?: number
}

export interface BrandKitType {
  id: string
  logo?: string
  theme: FormTheme
}

export interface WorkspaceType {
  id: string
  name: string
  ownerId: string
  avatar?: string
  clientName?: string
  customDomain?: string
  enableLeadReport?: boolean
  leadNotificationEmails?: string[]
  leadReportRangeDays?: number
  leadReportLastSentAt?: number
  removeBranding?: boolean
  reportingTimezone?: string
  inviteCode: string
  inviteCodeExpireAt?: number
  allowJoinByInviteLink: boolean
  storageQuota: number
  memberCount: number
  additionalSeats: number
  contactCount: number
  brandKits: BrandKitType[]
  isOwner?: boolean
  owner?: UserType
  createdAt?: number
  projects: ProjectType[]
  members: UserType[]
  aiKey?: string
  aiModel?: string
}

export interface WorkspaceLeadFlowType {
  clientName?: string
  leadNotificationEmails?: string[]
  enableLeadReport?: boolean
  leadReportRangeDays?: number
  leadReportLastSentAt?: number
  reportingTimezone?: string
  enableGoogleSheetsLeadSync?: boolean
  googleSheetsLeadConfig?: AnyMap
  googleSheetsLeadLastDeliveryAt?: number
  googleSheetsLeadLastDeliveryStatus?: string
  googleSheetsLeadLastDeliveryMessage?: string
}

export interface ProjectLeadFlowType {
  leadNotificationEmails?: string[]
  leadReportEmails?: string[]
  enableRespondentNotification?: boolean
  respondentNotificationSubject?: string
  respondentNotificationMessage?: string
  respondentNegativeNotificationSubject?: string
  respondentNegativeNotificationMessage?: string
  enableLeadReport?: boolean
  leadReportFrequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly'
  leadReportRangeDays?: number
  leadReportSubject?: string
  leadReportMessage?: string
  leadReportLastSentAt?: number
  reportingTimezone?: string
  enableGoogleSheetsLeadSync?: boolean
  googleSheetsLeadConfig?: AnyMap
  googleSheetsLeadLastDeliveryAt?: number
  googleSheetsLeadLastDeliveryStatus?: string
  googleSheetsLeadLastDeliveryMessage?: string
}

export interface MemberType {
  id: string
  name: string
  email: string
  avatar: string
  isOwner: boolean
  isYou: boolean
  lastSeenAt?: number
}

export interface DocumentType {
  id: string
  title: string
  description: string
}

export interface SearchResultType {
  forms: FormType[]
  docs: DocumentType[]
}
