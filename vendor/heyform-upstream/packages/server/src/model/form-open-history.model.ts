import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

import { nanoid } from '@heyform-inc/utils'

export enum FormSessionStatusEnum {
  ACTIVE = 'active',
  COMPLETED = 'completed'
}

@Schema({ _id: false })
export class FormSessionSourceModel {
  @Prop()
  landingUrl?: string

  @Prop()
  referrer?: string

  @Prop()
  utmSource?: string

  @Prop()
  utmMedium?: string

  @Prop()
  utmCampaign?: string

  @Prop()
  utmTerm?: string

  @Prop()
  utmContent?: string
}

export const FormSessionSourceSchema = SchemaFactory.createForClass(FormSessionSourceModel)

@Schema({ _id: false })
export class FormSessionQuestionMetricModel {
  @Prop({ required: true })
  questionId: string

  @Prop({ required: true })
  order: number

  @Prop()
  title?: string

  @Prop({ default: 0 })
  views: number

  @Prop({ default: 0 })
  totalDurationMs: number

  @Prop({ default: false })
  completed: boolean
}

export const FormSessionQuestionMetricSchema = SchemaFactory.createForClass(
  FormSessionQuestionMetricModel
)

@Schema({
  timestamps: true
})
export class FormOpenHistoryModel extends Document {
  @Prop({ default: () => nanoid(12) })
  _id: string

  @Prop({ required: true, index: true })
  formId: string

  @Prop({ required: true, index: true })
  projectId: string

  @Prop({ required: true, index: true })
  teamId: string

  @Prop({ required: true, index: true })
  anonymousId: string

  @Prop({ index: true })
  experimentId?: string

  @Prop({ index: true })
  variantFormId?: string

  @Prop({
    type: String,
    required: true,
    enum: Object.values(FormSessionStatusEnum),
    default: FormSessionStatusEnum.ACTIVE
  })
  status: FormSessionStatusEnum

  @Prop({ required: true, index: true })
  startAt: number

  @Prop({ required: true })
  lastSeenAt: number

  @Prop()
  completedAt?: number

  @Prop()
  totalDurationMs?: number

  @Prop()
  lastQuestionId?: string

  @Prop()
  lastQuestionOrder?: number

  @Prop({ type: FormSessionSourceSchema, default: {} })
  source?: FormSessionSourceModel

  @Prop({ type: [FormSessionQuestionMetricSchema], default: [] })
  questionMetrics?: FormSessionQuestionMetricModel[]
}

export const FormOpenHistorySchema = SchemaFactory.createForClass(FormOpenHistoryModel)

FormOpenHistorySchema.index({ formId: 1, startAt: -1 })
FormOpenHistorySchema.index({ projectId: 1, startAt: -1 })
FormOpenHistorySchema.index({ experimentId: 1, variantFormId: 1, startAt: -1 })
FormOpenHistorySchema.index({ formId: 1, anonymousId: 1, startAt: -1 })
FormOpenHistorySchema.index({ formId: 1, anonymousId: 1, status: 1, lastSeenAt: -1 })
