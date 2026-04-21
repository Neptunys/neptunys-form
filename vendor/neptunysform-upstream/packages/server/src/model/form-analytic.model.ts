import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export enum FormAnalyticRangeEnum {
  TODAY = 'today',
  WEEK = '7d',
  MONTH = '1m',
  THREE_MONTH = '3m',
  SIX_MONTH = '6m',
  YEAR = '1y',
  CUSTOM = 'custom'
}

@Schema({
  timestamps: true
})
export class FormAnalyticModel extends Document {
  @Prop({ required: true, index: true })
  formId: string

  @Prop({ required: true })
  totalVisits: number
}

export const FormAnalyticSchema = SchemaFactory.createForClass(FormAnalyticModel)
