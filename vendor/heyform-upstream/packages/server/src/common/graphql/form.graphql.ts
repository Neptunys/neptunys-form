import {
  ActionEnum,
  CalculateEnum,
  CaptchaKindEnum,
  Choice,
  Column,
  ComparisonEnum,
  FieldKindEnum,
  FieldLayoutAlignEnum,
  FormField,
  FormKindEnum,
  FormSettings,
  FormStatusEnum,
  HiddenField,
  InteractiveModeEnum,
  Layout,
  Logic,
  LogicAction,
  LogicCondition,
  LogicPayload,
  Property,
  Validation,
  Variable
} from '@heyform-inc/shared-types-enums'
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsUrl,
  Max,
  Min
} from 'class-validator'

import { TeamDetailInput } from './team.graphql'
import { FormAnalyticRangeEnum, FormModel, IntegrationStatusEnum } from '@model'
import { Field, InputType, ObjectType } from '@nestjs/graphql'
import GraphQLJSON, { GraphQLJSONObject } from 'graphql-type-json'

@InputType()
class ChoiceInput {
  @Field()
  id: string

  @Field()
  label: string

  @Field({ nullable: true })
  image?: string

  @Field({ nullable: true })
  color?: string

  @Field({ nullable: true })
  score?: number

  @Field({ nullable: true })
  isExpected?: boolean
}

@InputType()
class ColumnInput {
  @Field()
  id: string

  @Field()
  label: string

  @Field({ nullable: true })
  type?: string

  @Field({ nullable: true })
  required?: boolean
}

@InputType()
class PricePropertyInput {
  @Field()
  type: string

  @Field({ nullable: true })
  value?: number

  @Field({ nullable: true })
  ref?: string
}

@InputType()
class SharedPropertyInput {
  @Field({ nullable: true })
  showButton?: boolean

  @Field({ nullable: true })
  buttonText?: string

  @Field({ nullable: true })
  hideMarks?: boolean

  @Field({ nullable: true })
  consentText?: string

  @Field({ nullable: true })
  @IsOptional()
  consentLinkLabel?: string

  @Field({ nullable: true })
  @IsOptional()
  consentLinkUrl?: string

  @Field({ nullable: true })
  @IsOptional()
  showConsent?: boolean

  @Field({ nullable: true })
  allowOther?: boolean

  @Field({ nullable: true })
  allowMultiple?: boolean

  @Field({ nullable: true })
  badge?: string

  @Field({ nullable: true, defaultValue: true })
  verticalAlignment?: boolean

  @Field(type => [ChoiceInput], { nullable: true })
  choices?: Choice[]

  @Field({ nullable: true })
  randomize?: boolean

  @Field({ nullable: true })
  choiceStyle?: string

  @Field({ nullable: true })
  other?: string

  @Field({ nullable: true })
  numberPreRow?: number

  @Field({ nullable: true })
  shape?: string

  @Field({ nullable: true })
  total?: number

  @Field({ nullable: true })
  start?: number

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(24)
  @Max(96)
  optionSize?: number

  @Field({ nullable: true })
  @IsOptional()
  @IsIn(['left', 'center'])
  optionAlignment?: string

  @Field({ nullable: true })
  leftLabel?: string

  @Field({ nullable: true })
  centerLabel?: string

  @Field({ nullable: true })
  rightLabel?: string

  @Field({ nullable: true })
  @IsOptional()
  @IsIn(['both', 'first', 'last'])
  fullNameMode?: string

  @Field({ nullable: true })
  @IsOptional()
  showFirstName?: boolean

  @Field({ nullable: true })
  @IsOptional()
  showLastName?: boolean

  @Field({ nullable: true })
  @IsOptional()
  firstNameRequired?: boolean

  @Field({ nullable: true })
  @IsOptional()
  lastNameRequired?: boolean

  @Field({ nullable: true })
  @IsOptional()
  showPhoneNumber?: boolean

  @Field({ nullable: true })
  @IsOptional()
  phoneNumberRequired?: boolean

  @Field({ nullable: true })
  @IsOptional()
  showEmail?: boolean

  @Field({ nullable: true })
  @IsOptional()
  emailRequired?: boolean

  @Field({ nullable: true })
  @IsOptional()
  showCompany?: boolean

  @Field({ nullable: true })
  @IsOptional()
  companyRequired?: boolean

  @Field({ nullable: true })
  @IsOptional()
  showFieldIcons?: boolean

  @Field({ nullable: true })
  @IsOptional()
  mapToContacts?: boolean

  @Field({ nullable: true })
  @IsOptional()
  @IsIn(['subtle', 'boxed'])
  consentStyle?: string

  @Field({ nullable: true })
  defaultCountryCode?: string

  @Field({ nullable: true })
  @IsOptional()
  hideCountrySelect?: boolean

  @Field({ nullable: true })
  currency?: string

  @Field(type => PricePropertyInput, { nullable: true })
  price?: PricePropertyInput

  @Field({ nullable: true })
  format?: string

  @Field({ nullable: true })
  allowTime?: boolean

  @Field({ nullable: true })
  use12Hours?: boolean

  @Field(type => [ColumnInput], { nullable: true })
  tableColumns?: Column[]

  @Field({ nullable: true })
  score?: number

  @Field({ nullable: true })
  @IsOptional()
  enableShareIcon?: boolean

  @Field({ nullable: true })
  @IsOptional()
  enableCompleteTime?: boolean

  @Field({ nullable: true })
  @IsOptional()
  defaultChecked?: boolean

  @Field({ nullable: true })
  @IsOptional()
  showResponsePanel?: boolean

  @Field({ nullable: true })
  @IsUrl()
  sourceUrl?: string

  @Field({ nullable: true })
  @IsOptional()
  @IsUrl()
  buttonLinkUrl?: string

  @Field({ nullable: true })
  @IsOptional()
  @IsUrl()
  redirectUrl?: string

  @Field({ nullable: true })
  @IsOptional()
  redirectOnCompletion?: boolean

  @Field({ nullable: true })
  @IsOptional()
  redirectDelay?: number
}

@InputType()
export class PropertyInput extends SharedPropertyInput {
  @Field({ nullable: true })
  @IsOptional()
  showFieldIcons?: boolean

  @Field({ nullable: true })
  @IsOptional()
  @IsIn(['subtle', 'boxed'])
  consentStyle?: string

  @Field(type => [FormChildFieldInput], { nullable: true })
  fields?: FormField[]
}

@InputType()
class ValidationInput {
  @Field({ nullable: true })
  required?: boolean

  @Field({ nullable: true })
  min?: number

  @Field({ nullable: true })
  max?: number

  @Field({ nullable: true })
  matchExpected?: boolean
}

@InputType()
class LayoutInput {
  @Field({ nullable: true })
  @IsIn(['image', 'video'])
  mediaType?: string

  @Field({ nullable: true })
  @IsUrl()
  mediaUrl?: string

  @Field({ nullable: true })
  backgroundColor?: string

  @Field({ nullable: true })
  @Min(-100)
  @Max(100)
  brightness?: number

  @Field({ nullable: true })
  @IsEnum(FieldLayoutAlignEnum)
  align?: FieldLayoutAlignEnum

  @Field({ nullable: true })
  @IsOptional()
  @IsIn(['top', 'bottom'])
  inlineMediaPosition?: string

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(20)
  @Max(100)
  inlineMediaWidth?: number
}

@InputType()
class SharedFormFieldInput {
  @Field(type => GraphQLJSON, { nullable: true })
  title?: any[]

  @Field(type => GraphQLJSON, { nullable: true })
  description?: any[]

  @Field(type => String, { nullable: true })
  kind?: FieldKindEnum

  @Field(type => ValidationInput, { nullable: true })
  validations?: Validation

  @Field(type => SharedPropertyInput, { nullable: true })
  properties?: Property

  @Field({ nullable: true })
  width?: number

  @Field({ nullable: true })
  hide?: boolean

  @Field({ nullable: true })
  frozen?: boolean
}

@InputType()
class FormChildFieldInput extends SharedFormFieldInput {
  @Field()
  id: string

  @Field(type => String)
  kind: FieldKindEnum

  @Field(type => LayoutInput, { nullable: true })
  layout?: Layout
}

@InputType()
export class FormFieldInput extends SharedFormFieldInput {
  @Field()
  id: string

  @Field(type => String)
  kind: FieldKindEnum

  @Field(type => PropertyInput, { nullable: true })
  properties?: Property

  @Field(type => LayoutInput, { nullable: true })
  layout?: Layout
}

@InputType()
export class FormsInput {
  @Field()
  projectId: string

  @Field()
  @IsEnum(FormStatusEnum)
  status: FormStatusEnum

  @Field({ nullable: true })
  @IsOptional()
  keyword?: string
}

@InputType()
export class RecentFormsInput extends TeamDetailInput {
  @Field({ nullable: true, defaultValue: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  limit?: number
}

@InputType()
export class CreateFormInput {
  @Field()
  projectId: string

  @Field({ nullable: true })
  name?: string

  @Field(type => GraphQLJSON, { nullable: true })
  @IsArray()
  @IsOptional()
  nameSchema?: any[]

  @Field(type => GraphQLJSON)
  @IsEnum(InteractiveModeEnum)
  interactiveMode: InteractiveModeEnum

  @Field(type => GraphQLJSON)
  @IsEnum(FormKindEnum)
  kind: FormKindEnum
}

@InputType()
export class CreateFormWithAIInput {
  @Field()
  projectId: string

  @Field()
  topic: string

  @Field({ nullable: true })
  @IsOptional()
  reference?: string
}

@InputType()
export class FormDetailInput {
  @Field()
  formId: string
}

@InputType()
export class PublicFormRouteInput {
  @Field()
  hostname: string

  @Field({ nullable: true })
  @IsOptional()
  slug?: string
}

@InputType()
export class PublicRenderInput {
  @Field({ nullable: true })
  @IsOptional()
  formId?: string

  @Field({ nullable: true })
  @IsOptional()
  experimentId?: string

  @Field({ nullable: true })
  @IsOptional()
  hostname?: string

  @Field({ nullable: true })
  @IsOptional()
  slug?: string

  @Field({ nullable: true })
  @IsOptional()
  previewVariantFormId?: string
}

@InputType()
export class MoveFormInput extends FormDetailInput {
  @Field()
  targetProjectId: string
}

@InputType()
export class DuplicateFormInput {
  @Field()
  formId: string

  @Field()
  name: string
}

@InputType()
export class ImportExternalFormInput {
  @Field()
  projectId: string

  @Field()
  @IsUrl()
  url: string
}

@InputType()
export class UpdateFormCustomReportInput extends FormDetailInput {
  @Field(type => [String], { nullable: true })
  @IsArray()
  @IsOptional()
  hiddenFields?: string[]

  @Field(type => GraphQLJSONObject, { nullable: true })
  @IsObject()
  @IsOptional()
  theme?: Record<string, any>

  @Field({ nullable: true })
  @IsBoolean()
  @IsOptional()
  enablePublicAccess?: boolean
}

@InputType()
export class FormAnalyticInput extends FormDetailInput {
  @Field()
  @IsEnum(FormAnalyticRangeEnum)
  range: FormAnalyticRangeEnum

  @Field({ nullable: true })
  @IsOptional()
  sourceChannel?: string

  @Field({ nullable: true })
  @IsBoolean()
  @IsOptional()
  dedupeByIp?: boolean

  @Field({ nullable: true })
  @IsDateString()
  @IsOptional()
  startDate?: string

  @Field({ nullable: true })
  @IsDateString()
  @IsOptional()
  endDate?: string
}

@ObjectType()
export class FormSourceAnalyticType {
  @Field()
  channel: string

  @Field()
  totalVisits: number

  @Field()
  submissionCount: number
}

@ObjectType()
export class FormAnalyticResult {
  @Field()
  value: number

  @Field({ nullable: true })
  change?: number
}

@ObjectType()
export class FormAnalyticType {
  @Field(type => FormAnalyticResult)
  totalVisits: FormAnalyticResult

  @Field(type => FormAnalyticResult)
  submissionCount: FormAnalyticResult

  @Field(type => FormAnalyticResult)
  completeRate: FormAnalyticResult

  @Field(type => FormAnalyticResult)
  averageTime: FormAnalyticResult

  @Field(type => [FormSourceAnalyticType], { defaultValue: [] })
  sourceBreakdown: FormSourceAnalyticType[]
}

@ObjectType()
export class FormQuestionAnalyticType {
  @Field()
  questionId: string

  @Field()
  order: number

  @Field({ nullable: true })
  title?: string

  @Field()
  reachCount: number

  @Field()
  reachRate: number

  @Field()
  averageDuration: number

  @Field()
  completedCount: number

  @Field()
  dropOffCount: number

  @Field()
  dropOffRate: number

  @Field()
  frictionScore: number

  @Field()
  frictionLevel: string
}

@InputType()
export class UpdateFormInput extends FormDetailInput {
  @Field({ nullable: true })
  @IsOptional()
  name?: string

  @Field({ nullable: true })
  @IsOptional()
  slug?: string

  @Field({ nullable: true })
  @IsOptional()
  isDomainRoot?: boolean

  @Field(type => GraphQLJSON, { nullable: true })
  @IsEnum(FormKindEnum)
  @IsOptional()
  kind?: FormKindEnum

  @Field(type => Number, { nullable: true })
  @IsOptional()
  captchaKind?: CaptchaKindEnum

  @Field({ nullable: true })
  @IsOptional()
  active?: boolean

  @Field({ nullable: true })
  @IsOptional()
  enableExpirationDate?: boolean

  @Field({ nullable: true })
  @IsOptional()
  expirationTimeZone?: string

  @Field({ nullable: true })
  @IsOptional()
  @Min(0)
  enabledAt?: number

  @Field({ nullable: true })
  @IsOptional()
  @Min(0)
  closedAt?: number

  @Field({ nullable: true })
  @IsOptional()
  enableTimeLimit?: boolean

  @Field({ nullable: true })
  @IsOptional()
  @Min(0)
  timeLimit?: number

  @Field({ nullable: true })
  @IsOptional()
  filterSpam?: boolean

  @Field({ nullable: true })
  @IsOptional()
  password?: string

  @Field({ nullable: true })
  @IsOptional()
  requirePassword?: boolean

  @Field(type => [String], { nullable: true })
  @IsOptional()
  languages?: string[]

  //
  @Field({ nullable: true })
  @IsOptional()
  @IsUrl()
  redirectUrl?: string

  @Field({ nullable: true })
  @IsOptional()
  redirectOnCompletion?: boolean

  @Field({ nullable: true })
  @IsOptional()
  redirectDelay?: number

  @Field({ nullable: true })
  @IsOptional()
  enableQuotaLimit?: boolean

  @Field({ nullable: true })
  @IsOptional()
  @Min(1)
  quotaLimit?: number

  @Field({ nullable: true })
  @IsOptional()
  enableIpLimit?: boolean

  @Field({ nullable: true })
  @IsOptional()
  @Min(1)
  ipLimitCount?: number

  @Field({ nullable: true })
  @IsOptional()
  ipLimitTime?: number

  @Field({ nullable: true })
  @IsOptional()
  enableProgress?: boolean

  @Field({ nullable: true })
  @IsOptional()
  progressStyle?: string

  @Field({ nullable: true })
  @IsOptional()
  autoAdvanceSingleChoice?: boolean

  @Field({ nullable: true })
  @IsOptional()
  enableQuestionNumbers?: boolean

  @Field({ nullable: true })
  @IsOptional()
  enableQuestionList?: boolean

  @Field({ nullable: true })
  @IsOptional()
  enableNavigationArrows?: boolean

  @Field({ nullable: true })
  @IsOptional()
  emailNotification?: string

  @Field({ nullable: true })
  @IsOptional()
  locale?: string

  @Field({ nullable: true })
  @IsOptional()
  enableClosedMessage?: boolean

  @Field({ nullable: true })
  @IsOptional()
  closedFormTitle?: string

  @Field({ nullable: true })
  @IsOptional()
  closedFormDescription?: string

  @Field({ nullable: true })
  @IsOptional()
  allowArchive?: boolean

  @Field({ nullable: true })
  @IsOptional()
  metaTitle?: string

  @Field({ nullable: true })
  @IsOptional()
  metaDescription?: string

  @Field({ nullable: true })
  @IsUrl()
  @IsOptional()
  metaOGImageUrl?: string

  @Field({ nullable: true })
  @IsOptional()
  enableEmailNotification?: boolean

  @Field({ nullable: true })
  @IsOptional()
  enableLeadScoring?: boolean

  @Field({ nullable: true })
  @IsOptional()
  leadScoreVariableId?: string

  @Field({ nullable: true })
  @IsOptional()
  leadMediumThreshold?: number

  @Field({ nullable: true })
  @IsOptional()
  leadHighThreshold?: number

  @Field({ nullable: true })
  @IsOptional()
  leadQualityLowLabel?: string

  @Field({ nullable: true })
  @IsOptional()
  leadQualityMediumLabel?: string

  @Field({ nullable: true })
  @IsOptional()
  leadQualityHighLabel?: string

  @Field({ nullable: true })
  @IsOptional()
  leadPriorityLowLabel?: string

  @Field({ nullable: true })
  @IsOptional()
  leadPriorityMediumLabel?: string

  @Field({ nullable: true })
  @IsOptional()
  leadPriorityHighLabel?: string

  @Field({ nullable: true })
  @IsOptional()
  respondentNameFieldId?: string

  @Field({ nullable: true })
  @IsOptional()
  respondentEmailFieldId?: string

  @Field({ nullable: true })
  @IsOptional()
  respondentPhoneFieldId?: string

  @Field({ nullable: true })
  @IsOptional()
  trackLeadOnCapture?: boolean

  @Field({ nullable: true })
  @IsOptional()
  enableRespondentNotification?: boolean

  @Field({ nullable: true })
  @IsOptional()
  respondentNotificationSubject?: string

  @Field({ nullable: true })
  @IsOptional()
  respondentNotificationMessage?: string

  @Field({ nullable: true })
  @IsOptional()
  respondentNegativeNotificationSubject?: string

  @Field({ nullable: true })
  @IsOptional()
  respondentNegativeNotificationMessage?: string

  @Field({ nullable: true })
  @IsOptional()
  enableOperatorNotification?: boolean

  @Field(type => [String], { nullable: true })
  @IsArray()
  @IsOptional()
  operatorNotificationEmails?: string[]

  @Field(type => [String], { nullable: true })
  @IsArray()
  @IsOptional()
  selfEmailRecipients?: string[]

  @Field({ nullable: true })
  @IsOptional()
  operatorNotificationSubject?: string

  @Field({ nullable: true })
  @IsOptional()
  operatorNotificationMessage?: string
}

@InputType()
export class UpdateFormArchiveInput extends FormDetailInput {
  @Field()
  allowArchive: boolean
}

@InputType()
class LogicConditionInput {
  @Field()
  @IsEnum(Object.values(ComparisonEnum))
  comparison: string

  @Field(type => GraphQLJSON, { nullable: true })
  expected?: any

  @Field({ nullable: true })
  ref?: string
}

@InputType()
class LogicActionInput {
  @Field()
  @IsEnum(Object.values(ActionEnum))
  kind: string

  @Field({ nullable: true })
  fieldId?: string

  @Field({ nullable: true })
  variable?: string

  @Field({ nullable: true })
  @IsEnum(Object.values(CalculateEnum))
  operator?: string

  @Field(type => GraphQLJSON, { nullable: true })
  value?: any

  @Field({ nullable: true })
  ref?: string
}

@InputType()
class LogicPayloadInput {
  @Field()
  id: string

  @Field(type => LogicConditionInput)
  condition: LogicCondition

  @Field(type => LogicActionInput)
  action: LogicAction
}

@InputType()
class LogicInput {
  @Field()
  fieldId: string

  @Field(type => [LogicPayloadInput])
  payloads: LogicPayload[]
}

@InputType()
export class UpdateFormLogicsInput extends FormDetailInput {
  @Field(type => [LogicInput])
  logics: Logic[]
}

@InputType()
export class CreateFieldsWithAIInput extends FormDetailInput {
  @Field()
  prompt: string

  @Field({ nullable: true })
  @IsOptional()
  reference?: string
}

@InputType()
export class CreateFormThemeWithAIInput extends CreateFieldsWithAIInput {
  @Field()
  theme: string
}

@InputType()
class VariableInput {
  @Field()
  id: string

  @Field()
  name: string

  @Field()
  @IsEnum(['string', 'number'])
  kind: string

  @Field(type => GraphQLJSON)
  value: any
}

@InputType()
export class UpdateFormVariablesInput extends FormDetailInput {
  @Field(type => [VariableInput])
  variables: Variable[]
}

@InputType()
export class UpdateFormSchemasInput extends FormDetailInput {
  //

  //

  //

  @Field(type => [FormFieldInput])
  @IsArray()
  drafts: FormField[]

  @Field()
  version: number
}

@ObjectType()
export class FormSchemasType {
  @Field(type => [FormFieldType])
  drafts: FormField[]

  @Field()
  version: number

  @Field()
  canPublish: boolean
}

@InputType()
export class CreateFormFieldInput extends FormDetailInput {
  @Field(type => FormFieldInput)
  field: Record<string, any>
}

@InputType()
export class DeleteFormFieldInput extends FormDetailInput {
  @Field()
  fieldId: string
}

@InputType()
export class UpdateFormFieldInput extends DeleteFormFieldInput {
  @Field(type => SharedFormFieldInput)
  updates: Record<string, any>
}

@InputType()
class HiddenFieldInput {
  @Field()
  id: string

  @Field()
  name: string
}

@InputType()
export class UpdateHiddenFieldsInput extends FormDetailInput {
  @Field(type => [HiddenFieldInput])
  hiddenFields: HiddenField[]
}

@InputType()
export class FormThemeInput {
  @Field({ nullable: true })
  fontFamily?: string

  @Field({ nullable: true })
  titleFontSize?: string

  @Field({ nullable: true })
  @IsOptional()
  @Min(20)
  @Max(96)
  titleFontSizePx?: number

  @Field({ nullable: true })
  @IsOptional()
  @Min(20)
  @Max(96)
  mobileTitleFontSizePx?: number

  @Field({ nullable: true })
  screenFontSize?: string

  @Field({ nullable: true })
  @IsOptional()
  @Min(12)
  @Max(48)
  descriptionFontSizePx?: number

  @Field({ nullable: true })
  @IsOptional()
  @Min(12)
  @Max(48)
  mobileDescriptionFontSizePx?: number

  @Field({ nullable: true })
  fieldFontSize?: string

  @Field({ nullable: true })
  @IsOptional()
  @Min(12)
  @Max(56)
  answerFontSizePx?: number

  @Field({ nullable: true })
  @IsOptional()
  @Min(12)
  @Max(56)
  mobileAnswerFontSizePx?: number

  @Field({ nullable: true })
  questionTextColor?: string

  @Field({ nullable: true })
  answerTextColor?: string

  @Field({ nullable: true })
  answerKeyBackground?: string

  @Field({ nullable: true })
  answerKeyActiveColor?: string

  @Field({ nullable: true })
  answerKeyActiveBackground?: string

  @Field({ nullable: true })
  @IsOptional()
  showChoiceCheckIcon?: boolean

  @Field({ nullable: true })
  answerBorderRadius?: number

  @Field({ nullable: true })
  logoSize?: number

  @Field({ nullable: true })
  buttonBackground?: string

  @Field({ nullable: true })
  buttonTextColor?: string

  @Field({ nullable: true })
  desktopBackButtonBackground?: string

  @Field({ nullable: true })
  buttonBorderRadius?: number

  @Field({ nullable: true })
  backgroundColor?: string

  @Field({ nullable: true })
  backgroundImage?: string

  @Field({ nullable: true })
  desktopBackgroundImage?: string

  @Field({ nullable: true })
  mobileBackgroundImage?: string

  @Field({ nullable: true })
  @IsOptional()
  @Min(-100)
  @Max(100)
  desktopBackgroundBrightness?: number

  @Field({ nullable: true })
  @IsOptional()
  @Min(-100)
  @Max(100)
  mobileBackgroundBrightness?: number

  @Field({ nullable: true })
  @IsOptional()
  @Min(360)
  @Max(1440)
  desktopContentWidth?: number

  @Field({ nullable: true })
  @IsOptional()
  @Min(240)
  @Max(720)
  mobileContentWidth?: number

  @Field({ nullable: true })
  @IsOptional()
  @Min(240)
  @Max(960)
  desktopAnswerWidth?: number

  @Field({ nullable: true })
  @IsOptional()
  @Min(160)
  @Max(640)
  mobileAnswerWidth?: number

  @Field({ nullable: true })
  @IsOptional()
  @Min(0)
  @Max(48)
  desktopAnswerGap?: number

  @Field({ nullable: true })
  @IsOptional()
  @Min(0)
  @Max(32)
  mobileAnswerGap?: number

  @Field({ nullable: true })
  @IsOptional()
  @Min(-320)
  @Max(320)
  desktopContentOffset?: number

  @Field({ nullable: true })
  @Min(-100)
  @Max(100)
  backgroundBrightness?: number

  @Field({ nullable: true })
  progressColor?: string

  @Field({ nullable: true })
  progressTrackColor?: string

  @Field({ nullable: true })
  topProgressColor?: string

  @Field({ nullable: true })
  topProgressTrackColor?: string

  @Field({ nullable: true })
  customCSS?: string
}

@InputType()
export class UpdateFormThemeInput extends FormDetailInput {
  @Field({ nullable: true })
  @IsOptional()
  logo?: string

  @Field(type => FormThemeInput)
  theme: FormThemeInput
}

@InputType()
export class SearchFormInput {
  @Field()
  keyword: string
}

@ObjectType()
export class ChoiceType {
  @Field()
  id: string

  @Field()
  label: string

  @Field({ nullable: true })
  image?: string

  @Field({ nullable: true })
  color?: string

  @Field({ nullable: true })
  score?: number

  @Field({ nullable: true })
  isExpected?: boolean
}

@ObjectType()
export class PropertyType {
  @Field({ nullable: true })
  showButton?: boolean

  @Field({ nullable: true })
  buttonText?: string

  @Field({ nullable: true })
  hideMarks?: boolean

  @Field({ nullable: true })
  consentText?: string

  @Field({ nullable: true })
  consentLinkLabel?: string

  @Field({ nullable: true })
  consentLinkUrl?: string

  @Field({ nullable: true })
  showConsent?: boolean

  @Field({ nullable: true })
  allowOther?: boolean

  @Field({ nullable: true })
  allowMultiple?: boolean

  @Field(type => [ChoiceType], { nullable: true })
  choices?: Choice[]

  @Field({ nullable: true })
  other?: string

  @Field({ nullable: true })
  numberPreRow?: number

  @Field({ nullable: true })
  shape?: string

  @Field({ nullable: true })
  total?: number

  @Field({ nullable: true })
  start?: number

  @Field({ nullable: true })
  leftLabel?: string

  @Field({ nullable: true })
  centerLabel?: string

  @Field({ nullable: true })
  rightLabel?: string

  @Field({ nullable: true })
  fullNameMode?: string

  @Field({ nullable: true })
  showFirstName?: boolean

  @Field({ nullable: true })
  showLastName?: boolean

  @Field({ nullable: true })
  firstNameRequired?: boolean

  @Field({ nullable: true })
  lastNameRequired?: boolean

  @Field({ nullable: true })
  showPhoneNumber?: boolean

  @Field({ nullable: true })
  phoneNumberRequired?: boolean

  @Field({ nullable: true })
  showEmail?: boolean

  @Field({ nullable: true })
  emailRequired?: boolean

  @Field({ nullable: true })
  showCompany?: boolean

  @Field({ nullable: true })
  companyRequired?: boolean

  @Field({ nullable: true })
  showFieldIcons?: boolean

  @Field({ nullable: true })
  mapToContacts?: boolean

  @Field({ nullable: true })
  consentStyle?: string

  @Field({ nullable: true })
  defaultCountryCode?: string

  @Field({ nullable: true })
  hideCountrySelect?: boolean

  @Field({ nullable: true })
  currency?: string

  @Field({ nullable: true })
  price?: number

  @Field({ nullable: true })
  format?: string

  @Field({ nullable: true })
  use12Hours?: boolean

  @Field({ nullable: true })
  score?: number

  @Field({ nullable: true })
  defaultChecked?: boolean
}

@ObjectType()
export class ValidationType {
  @Field({ nullable: true })
  required?: boolean

  @Field({ nullable: true })
  min?: number

  @Field({ nullable: true })
  max?: number

  @Field({ nullable: true })
  matchExpected?: boolean
}

@ObjectType()
export class FormSettingType {
  @Field({ nullable: true })
  captchaKind?: number

  @Field({ nullable: true })
  googleRecaptchaKey?: string

  @Field({ nullable: true })
  active?: boolean

  @Field({ nullable: true })
  enableExpirationDate?: boolean

  @Field({ nullable: true })
  expirationTimeZone?: string

  @Field({ nullable: true })
  enabledAt?: number

  @Field({ nullable: true })
  closedAt?: number

  @Field({ nullable: true })
  enableTimeLimit?: boolean

  @Field({ nullable: true })
  timeLimit?: number

  @Field({ nullable: true })
  filterSpam?: boolean

  @Field({ nullable: true })
  allowArchive?: boolean

  @Field({ nullable: true })
  password?: string

  @Field({ nullable: true })
  requirePassword?: boolean

  //
  @Field({ nullable: true })
  redirectOnCompletion?: boolean

  @Field({ nullable: true })
  redirectUrl?: string

  @Field({ nullable: true })
  redirectDelay?: number

  @Field({ nullable: true })
  enableQuotaLimit?: boolean

  @Field({ nullable: true })
  quotaLimit?: number

  @Field({ nullable: true })
  enableIpLimit?: boolean

  @Field({ nullable: true })
  ipLimitCount?: number

  @Field({ nullable: true })
  ipLimitTime?: number

  @Field({ nullable: true })
  enableProgress?: boolean

  @Field({ nullable: true })
  progressStyle?: string

  @Field({ nullable: true })
  autoAdvanceSingleChoice?: boolean

  @Field({ nullable: true })
  enableQuestionNumbers?: boolean

  @Field({ nullable: true })
  enableQuestionList?: boolean

  @Field({ nullable: true })
  enableNavigationArrows?: boolean

  @Field({ nullable: true })
  locale?: string

  @Field(type => [String], { nullable: true, defaultValue: [] })
  languages?: string[]

  @Field({ nullable: true })
  enableClosedMessage?: boolean

  @Field({ nullable: true })
  closedFormTitle?: string

  @Field({ nullable: true })
  closedFormDescription?: string

  @Field({ nullable: true })
  metaTitle?: string

  @Field({ nullable: true })
  metaDescription?: string

  @Field({ nullable: true })
  metaOGImageUrl?: string

  @Field({ nullable: true })
  enableEmailNotification?: boolean

  @Field({ nullable: true })
  enableLeadScoring?: boolean

  @Field({ nullable: true })
  leadScoreVariableId?: string

  @Field({ nullable: true })
  leadMediumThreshold?: number

  @Field({ nullable: true })
  leadHighThreshold?: number

  @Field({ nullable: true })
  leadQualityLowLabel?: string

  @Field({ nullable: true })
  leadQualityMediumLabel?: string

  @Field({ nullable: true })
  leadQualityHighLabel?: string

  @Field({ nullable: true })
  leadPriorityLowLabel?: string

  @Field({ nullable: true })
  leadPriorityMediumLabel?: string

  @Field({ nullable: true })
  leadPriorityHighLabel?: string

  @Field({ nullable: true })
  respondentNameFieldId?: string

  @Field({ nullable: true })
  respondentEmailFieldId?: string

  @Field({ nullable: true })
  respondentPhoneFieldId?: string

  @Field({ nullable: true })
  trackLeadOnCapture?: boolean

  @Field({ nullable: true })
  enableRespondentNotification?: boolean

  @Field({ nullable: true })
  respondentNotificationSubject?: string

  @Field({ nullable: true })
  respondentNotificationMessage?: string

  @Field({ nullable: true })
  respondentNegativeNotificationSubject?: string

  @Field({ nullable: true })
  respondentNegativeNotificationMessage?: string

  @Field({ nullable: true })
  enableOperatorNotification?: boolean

  @Field(type => [String], { nullable: true })
  operatorNotificationEmails?: string[]

  @Field(type => [String], { nullable: true })
  selfEmailRecipients?: string[]

  @Field({ nullable: true })
  operatorNotificationSubject?: string

  @Field({ nullable: true })
  operatorNotificationMessage?: string
}

@ObjectType()
export class ThemeSettingsType {
  @Field({ nullable: true })
  logo?: string

  @Field(type => GraphQLJSONObject, { nullable: true })
  theme?: Record<string, any>
}

@ObjectType()
export class FormFieldType {
  @Field()
  id: string

  @Field(type => GraphQLJSON, { nullable: true })
  title?: any[]

  @Field(type => GraphQLJSON, { nullable: true })
  titleSchema?: any[]

  @Field(type => GraphQLJSON, { nullable: true })
  description?: any[]

  @Field(type => String)
  kind: FieldKindEnum

  @Field(type => GraphQLJSONObject, { nullable: true })
  validations?: Validation

  @Field(type => GraphQLJSONObject, { nullable: true })
  properties?: Property

  @Field(type => GraphQLJSONObject, { nullable: true })
  layout?: Layout

  @Field({ nullable: true })
  width?: number

  @Field({ nullable: true })
  hide?: boolean

  @Field({ nullable: true })
  frozen?: boolean
}

@ObjectType()
export class HiddenFieldType {
  @Field()
  id: string

  @Field()
  name: string
}

@ObjectType()
export class PageBackgroundType {
  @Field({ nullable: true })
  backgroundPosition?: string

  @Field({ nullable: true })
  backgroundColor?: string

  @Field({ nullable: true })
  backgroundImage?: string
}

//

//

@ObjectType()
class StripeAccountType {
  @Field()
  accountId: string

  @Field()
  email: string
}

@ObjectType()
export class FormCustomReportType {
  @Field()
  id: string

  @Field(type => [String], { nullable: true })
  hiddenFields?: string[]

  @Field(type => GraphQLJSONObject, { nullable: true })
  theme?: Record<string, any>

  @Field({ nullable: true })
  enablePublicAccess?: boolean
}

@ObjectType()
export class FormType {
  @Field()
  id: string

  @Field()
  teamId: string

  @Field()
  projectId: string

  @Field()
  name: string

  @Field({ nullable: true })
  slug?: string

  @Field({ nullable: true })
  isDomainRoot?: boolean

  @Field({ nullable: true })
  description?: string

  @Field(type => String)
  interactiveMode: InteractiveModeEnum

  @Field(type => String)
  kind: FormKindEnum

  @Field()
  memberId: string

  @Field(type => FormSettingType, { nullable: true })
  settings?: FormSettings

  //

  @Field(type => [FormFieldType], { nullable: true })
  drafts?: FormField[]

  @Field(type => [HiddenFieldType], { nullable: true })
  hiddenFields?: HiddenField[]

  @Field(type => GraphQLJSONObject, { nullable: true })
  translations?: FormModel['translations']

  @Field(type => [GraphQLJSONObject], { nullable: true })
  logics?: Logic[]

  @Field(type => [GraphQLJSONObject], { nullable: true })
  variables?: Variable[]

  @Field(type => StripeAccountType, { nullable: true })
  stripeAccount?: StripeAccountType

  @Field(type => ThemeSettingsType, { nullable: true })
  themeSettings?: ThemeSettingsType

  @Field({ nullable: true, defaultValue: 0 })
  fieldsUpdatedAt?: number

  @Field({ nullable: true })
  submissionCount?: number

  @Field({ nullable: true })
  retentionAt?: number

  @Field({ nullable: true })
  suspended?: boolean

  @Field(type => String, { nullable: true })
  status?: FormStatusEnum

  @Field({ nullable: true })
  updatedAt?: number

  @Field({ nullable: true })
  isDraft: boolean

  @Field({ nullable: true })
  version: number

  @Field({ nullable: true })
  canPublish: boolean

  @Field(type => FormCustomReportType, { nullable: true })
  customReport: FormCustomReportType
}

@ObjectType()
export class PublicFormType extends FormType {
  @Field(type => [FormFieldType], { nullable: true })
  fields: FormField[]

  @Field(type => GraphQLJSONObject, { nullable: true })
  translations: FormModel['translations']

  @Field(type => GraphQLJSONObject, { nullable: true })
  integrations?: Record<string, string>
}

@ObjectType()
export class PublicRenderType {
  @Field(type => PublicFormType)
  form: PublicFormType

  @Field({ nullable: true })
  experimentId?: string
}

@ObjectType()
export class SearchFormType {
  @Field({ nullable: true })
  teamId?: string

  @Field({ nullable: true })
  teamName?: string

  @Field({ nullable: true })
  formId?: string

  @Field({ nullable: true })
  formName?: string

  @Field({ nullable: true })
  templateId?: string

  @Field({ nullable: true })
  templateName?: string
}

//

//

//

@ObjectType()
export class FormReportResponseType {
  @Field()
  id: string

  @Field({ nullable: true })
  kind?: string

  @Field({ nullable: true })
  title?: string

  @Field()
  total: number

  @Field()
  count: number

  @Field()
  average: number

  @Field(type => GraphQLJSON)
  chooses?: any
}

@ObjectType()
class FormReportAnswerType {
  @Field()
  submissionId: string

  @Field()
  kind: string

  @Field(type => GraphQLJSON, { nullable: true })
  value: any

  @Field()
  endAt: number
}

@ObjectType()
class FormReportSubmissionType {
  @Field()
  _id: string

  @Field(type => [FormReportAnswerType])
  answers: FormReportAnswerType[]
}

@ObjectType()
export class FormReportType {
  @Field(type => [FormReportResponseType])
  responses: FormReportResponseType[]

  @Field(type => [FormReportSubmissionType])
  submissions: FormReportSubmissionType[]
}

@ObjectType()
export class FormIntegrationType {
  @Field({ nullable: true })
  formId: string

  @Field()
  appId: string

  @Field(type => GraphQLJSONObject)
  config?: Record<string, any>

  @Field(type => Number)
  status: IntegrationStatusEnum

  @Field(type => Number, { nullable: true })
  lastDeliveryAt?: number

  @Field({ nullable: true })
  lastDeliveryStatus?: string

  @Field({ nullable: true })
  lastDeliveryMessage?: string
}

@InputType()
export class ExportFormToJSONInput extends FormDetailInput {}

@InputType()
export class ImportFormFromJSONInput {
  @Field()
  projectId: string

  @Field()
  formJson: string
}
