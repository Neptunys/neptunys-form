import { HiddenFieldAnswer } from '@heyform-inc/shared-types-enums'
import { IsOptional, IsString } from 'class-validator'

import { CdnTokenInput } from './user.graphql'
import { Field, InputType, ObjectType } from '@nestjs/graphql'
import { GraphQLJSONObject } from 'graphql-type-json'

@InputType()
export class UploadFormFileInput extends CdnTokenInput {
  @Field()
  formId: string
}

@InputType()
export class UploadFormSignatureInput {
  @Field()
  formId: string

  @Field()
  signature: string
}

@InputType()
export class OpenFormInput {
  @Field()
  formId: string

  @Field({ nullable: true })
  experimentId?: string

  @Field({ nullable: true })
  variantFormId?: string

  @Field({ nullable: true })
  landingUrl?: string

  @Field({ nullable: true })
  referrer?: string

  @Field({ nullable: true })
  utmSource?: string

  @Field({ nullable: true })
  utmMedium?: string

  @Field({ nullable: true })
  utmCampaign?: string

  @Field({ nullable: true })
  utmTerm?: string

  @Field({ nullable: true })
  utmContent?: string
}

@InputType()
export class VerifyPasswordInput {
  @Field()
  formId: string

  @Field()
  password: string
}

@InputType()
class HiddenFieldAnswerInput {
  @Field()
  id: string

  @Field()
  name: string

  @Field({ nullable: true })
  value?: string
}

@InputType()
export class FormSessionQuestionMetricInput {
  @Field()
  questionId: string

  @Field()
  order: number

  @Field({ nullable: true })
  title?: string

  @Field()
  views: number

  @Field()
  totalDurationMs: number

  @Field()
  completed: boolean
}

@InputType()
export class UpdateFormSessionInput {
  @Field()
  formId: string

  @Field()
  openToken: string

  @Field(type => [FormSessionQuestionMetricInput])
  metrics: FormSessionQuestionMetricInput[]

  @Field({ nullable: true })
  lastQuestionId?: string

  @Field({ nullable: true })
  lastQuestionOrder?: number
}

@InputType()
export class CompleteSubmissionInput {
  @Field()
  formId: string

  @Field(type => GraphQLJSONObject)
  answers: Record<string, any>

  @Field(type => [HiddenFieldAnswerInput])
  hiddenFields: HiddenFieldAnswer[]

  @Field({ nullable: true })
  partialSubmission?: boolean

  @Field()
  openToken: string

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  passwordToken?: string

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  recaptchaToken?: string
}

@ObjectType()
export class CompleteSubmissionType {
  @Field({ nullable: true })
  clientSecret?: string
}

@ObjectType()
export class UploadFormFileType {
  @Field()
  filename: string

  @Field()
  url: string

  @Field()
  size: number
}
