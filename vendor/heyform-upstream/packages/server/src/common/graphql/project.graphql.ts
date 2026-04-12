import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator'

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

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enableLeadReport?: boolean

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  leadReportRangeDays?: number

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reportingTimezone?: string
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

  @Field({ nullable: true })
  enableLeadReport?: boolean

  @Field({ nullable: true })
  leadReportRangeDays?: number

  @Field({ nullable: true })
  leadReportLastSentAt?: number

  @Field({ nullable: true })
  reportingTimezone?: string
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
