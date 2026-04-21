import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

import { nanoid } from '@neptunysform-inc/utils'

export enum ExperimentStatusEnum {
  RUNNING = 'running',
  COMPLETED = 'completed',
  PROMOTED = 'promoted'
}

export enum ExperimentPrimaryMetricEnum {
  CONVERSION_RATE = 'conversionRate'
}

@Schema({ _id: false })
export class ExperimentVariantModel {
  @Prop({ required: true })
  formId: string

  @Prop({ required: true, default: 50 })
  weight: number
}

export const ExperimentVariantSchema = SchemaFactory.createForClass(ExperimentVariantModel)

@Schema({ timestamps: true })
export class ExperimentModel extends Document {
  @Prop({ default: () => nanoid(8) })
  _id: string

  @Prop({ required: true, index: true })
  teamId: string

  @Prop({ required: true, index: true })
  projectId: string

  @Prop({ required: true })
  name: string

  @Prop({
    type: String,
    required: true,
    enum: Object.values(ExperimentStatusEnum),
    default: ExperimentStatusEnum.RUNNING
  })
  status: ExperimentStatusEnum

  @Prop({
    type: String,
    required: true,
    enum: Object.values(ExperimentPrimaryMetricEnum),
    default: ExperimentPrimaryMetricEnum.CONVERSION_RATE
  })
  primaryMetric: ExperimentPrimaryMetricEnum

  @Prop({ type: [ExperimentVariantSchema], default: [] })
  variants: ExperimentVariantModel[]

  @Prop({ default: true })
  autoPromote: boolean

  @Prop({ default: 48 })
  durationHours: number

  @Prop({ default: 0 })
  minimumSampleSize: number

  @Prop({ required: true })
  startAt: number

  @Prop({ required: true })
  endAt: number

  @Prop()
  winnerFormId?: string

  @Prop()
  promotedAt?: number
}

export const ExperimentSchema = SchemaFactory.createForClass(ExperimentModel)

ExperimentSchema.index({ projectId: 1, createdAt: -1 })
ExperimentSchema.index({ status: 1, endAt: 1 })