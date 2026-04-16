import { IsArray, IsBoolean, IsEmail, IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator'
import { GraphQLJSONObject } from 'graphql-type-json'

import { TeamDetailInput } from './team.graphql'
import { Field, InputType, ObjectType } from '@nestjs/graphql'

@InputType()
export class CreateProjectInput extends TeamDetailInput {
  @Field()
  name: string

  @Field({ nullable: true })
  @IsOptional()
  avatar?: string

  @Field(type => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  memberIds?: string[]
}

@InputType()
export class ProjectDetailInput {
  @Field()
  projectId: string
}

@InputType()
export class DeleteProjectInput extends ProjectDetailInput {
  @Field()
  code: string
}

@InputType()
export class RenameProjectInput extends ProjectDetailInput {
  @Field()
  name: string
}

@InputType()
export class UpdateProjectInput extends ProjectDetailInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  launchPath?: string

  @Field({ nullable: true })
  @IsOptional()
  @IsIn(['form', 'experiment'])
  launchMode?: string

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  launchFormId?: string

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  launchExperimentId?: string

  @Field(type => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  leadNotificationEmails?: string[]

  @Field(type => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  leadReportEmails?: string[]

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enableRespondentNotification?: boolean

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  respondentNotificationSubject?: string

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  respondentNotificationMessage?: string

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  respondentNegativeNotificationSubject?: string

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  respondentNegativeNotificationMessage?: string

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enableLeadReport?: boolean

  @Field({ nullable: true })
  @IsOptional()
  @IsIn(['daily', 'weekly', 'biweekly', 'monthly'])
  leadReportFrequency?: string

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  leadReportRangeDays?: number

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  leadReportSubject?: string

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  leadReportMessage?: string

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reportingTimezone?: string

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enableGoogleSheetsLeadSync?: boolean

  @Field(type => GraphQLJSONObject, { nullable: true })
  @IsOptional()
  googleSheetsLeadConfig?: Record<string, any>
}

@InputType()
export class TestProjectGoogleSheetsInput extends ProjectDetailInput {
  @Field(type => GraphQLJSONObject)
  googleSheetsLeadConfig: Record<string, any>
}

@InputType()
export class SendProjectEmailTestInput extends ProjectDetailInput {
  @Field()
  @IsIn(['confirmation', 'negative_confirmation', 'recap'])
  emailType: string

  @Field()
  @IsEmail()
  recipientEmail: string

  @Field(type => GraphQLJSONObject, { nullable: true })
  @IsOptional()
  settingsOverride?: Record<string, any>
}

@InputType()
export class ProjectMemberInput {
  @Field()
  projectId: string

  @Field()
  memberId: string
}

@ObjectType()
export class ProjectMemberType {
  @Field()
  id: string

  @Field()
  name: string

  @Field()
  email: string

  @Field()
  avatar: string

  @Field()
  isOwner?: boolean
}

@ObjectType()
export class ProjectType {
  @Field()
  id: string

  @Field()
  teamId: string

  @Field()
  name: string

  @Field({ nullable: true })
  icon?: string

  @Field({ nullable: true })
  launchPath?: string

  @Field({ nullable: true })
  launchMode?: string

  @Field({ nullable: true })
  launchFormId?: string

  @Field({ nullable: true })
  launchExperimentId?: string

  @Field()
  ownerId: string

  @Field(type => [String], { nullable: true })
  members?: string[]

  @Field({ nullable: true })
  formCount?: number

  @Field({ nullable: true })
  isOwner?: boolean

  @Field(type => [String], { nullable: true })
  leadNotificationEmails?: string[]

  @Field(type => [String], { nullable: true })
  leadReportEmails?: string[]

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
  enableLeadReport?: boolean

  @Field({ nullable: true })
  leadReportFrequency?: string

  @Field({ nullable: true })
  leadReportRangeDays?: number

  @Field({ nullable: true })
  leadReportSubject?: string

  @Field({ nullable: true })
  leadReportMessage?: string

  @Field({ nullable: true })
  leadReportLastSentAt?: number

  @Field({ nullable: true })
  reportingTimezone?: string

  @Field({ nullable: true })
  enableGoogleSheetsLeadSync?: boolean

  @Field(type => GraphQLJSONObject, { nullable: true })
  googleSheetsLeadConfig?: Record<string, any>

  @Field({ nullable: true })
  googleSheetsLeadLastDeliveryAt?: number

  @Field({ nullable: true })
  googleSheetsLeadLastDeliveryStatus?: string

  @Field({ nullable: true })
  googleSheetsLeadLastDeliveryMessage?: string
}

@ObjectType()
export class ProjectLeadFlowType {
  @Field(type => [String], { nullable: true })
  leadNotificationEmails?: string[]

  @Field(type => [String], { nullable: true })
  leadReportEmails?: string[]

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
  enableLeadReport?: boolean

  @Field({ nullable: true })
  leadReportFrequency?: string

  @Field({ nullable: true })
  leadReportRangeDays?: number

  @Field({ nullable: true })
  leadReportSubject?: string

  @Field({ nullable: true })
  leadReportMessage?: string

  @Field({ nullable: true })
  leadReportLastSentAt?: number

  @Field({ nullable: true })
  reportingTimezone?: string

  @Field({ nullable: true })
  enableGoogleSheetsLeadSync?: boolean

  @Field(type => GraphQLJSONObject, { nullable: true })
  googleSheetsLeadConfig?: Record<string, any>

  @Field({ nullable: true })
  googleSheetsLeadLastDeliveryAt?: number

  @Field({ nullable: true })
  googleSheetsLeadLastDeliveryStatus?: string

  @Field({ nullable: true })
  googleSheetsLeadLastDeliveryMessage?: string
}

@ObjectType()
export class ProjectLaunchOverviewType {
  @Field()
  projectId: string

  @Field()
  formCount: number

  @Field()
  publishedFormCount: number

  @Field()
  experimentCount: number

  @Field()
  runningExperimentCount: number

  @Field()
  leadCount30d: number

  @Field()
  highPriorityLeadCount30d: number

  @Field({ nullable: true })
  lastLeadAt?: number
}

@ObjectType()
export class PublicRouteType {
  @Field()
  kind: string

  @Field({ nullable: true })
  formId?: string

  @Field({ nullable: true })
  experimentId?: string

  @Field({ nullable: true })
  projectId?: string
}
