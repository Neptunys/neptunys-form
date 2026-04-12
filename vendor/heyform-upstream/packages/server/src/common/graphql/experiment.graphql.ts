import { IsArray, IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator'

import { Field, InputType, ObjectType } from '@nestjs/graphql'

import { ProjectDetailInput } from './project.graphql'

@InputType()
export class ExperimentDetailInput {
  @Field()
  experimentId: string
}

@InputType()
export class PublicExperimentInput extends ExperimentDetailInput {}

@InputType()
export class ProjectExperimentInput extends ProjectDetailInput {
  @Field()
  experimentId: string
}

@InputType()
export class ExperimentVariantInput {
  @Field()
  formId: string

  @Field({ nullable: true, defaultValue: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  weight?: number
}

@InputType()
export class CreateExperimentInput extends ProjectDetailInput {
  @Field()
  name: string

  @Field(type => [ExperimentVariantInput])
  @IsArray()
  variants: ExperimentVariantInput[]

  @Field({ nullable: true, defaultValue: true })
  @IsOptional()
  @IsBoolean()
  autoPromote?: boolean

  @Field({ nullable: true, defaultValue: 48 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(24 * 30)
  durationHours?: number

  @Field({ nullable: true, defaultValue: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumSampleSize?: number
}

@InputType()
export class UpdateExperimentInput extends ProjectExperimentInput {
  @Field({ nullable: true })
  @IsOptional()
  name?: string

  @Field(type => [ExperimentVariantInput], { nullable: true })
  @IsOptional()
  @IsArray()
  variants?: ExperimentVariantInput[]

  @Field({ nullable: true })
  @IsOptional()
  status?: string

  @Field({ nullable: true })
  @IsOptional()
  winnerFormId?: string

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  autoPromote?: boolean

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(24 * 30)
  durationHours?: number

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumSampleSize?: number
}

@ObjectType()
export class ExperimentVariantType {
  @Field()
  formId: string

  @Field()
  weight: number
}

@ObjectType()
export class ExperimentVariantMetricType {
  @Field()
  formId: string

  @Field()
  weight: number

  @Field()
  visits: number

  @Field()
  submissions: number

  @Field()
  conversionRate: number

  @Field()
  averageTime: number

  @Field()
  isWinner: boolean

  @Field()
  meetsMinimumSample: boolean

  @Field()
  minimumSampleGap: number
}

@ObjectType()
export class ExperimentType {
  @Field()
  id: string

  @Field()
  teamId: string

  @Field()
  projectId: string

  @Field()
  name: string

  @Field()
  status: string

  @Field()
  primaryMetric: string

  @Field(type => [ExperimentVariantType])
  variants: ExperimentVariantType[]

  @Field()
  autoPromote: boolean

  @Field()
  durationHours: number

  @Field()
  minimumSampleSize: number

  @Field()
  startAt: number

  @Field()
  endAt: number

  @Field({ nullable: true })
  winnerFormId?: string

  @Field({ nullable: true })
  promotedAt?: number

  @Field()
  minimumSampleReached: boolean

  @Field({ nullable: true })
  promotionBlockedReason?: string

  @Field(type => [ExperimentVariantMetricType], { nullable: true })
  metrics?: ExperimentVariantMetricType[]
}

@ObjectType()
export class PublicExperimentType {
  @Field()
  experimentId: string

  @Field()
  formId: string

  @Field({ nullable: true })
  winnerFormId?: string
}