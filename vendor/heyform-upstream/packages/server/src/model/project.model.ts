import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

import { nanoid } from '@heyform-inc/utils'

@Schema({
  timestamps: true
})
export class ProjectModel extends Document {
  @Prop({ default: () => nanoid(8) })
  _id: string

  @Prop({ required: true, index: true })
  teamId: string

  @Prop({ required: true })
  name: string

  @Prop()
  icon?: string

  @Prop({ required: true })
  ownerId: string

  @Prop()
  avatar?: string

  @Prop({ index: true })
  launchPath?: string

  @Prop()
  launchMode?: string

  @Prop()
  launchFormId?: string

  @Prop()
  launchExperimentId?: string

  @Prop({ type: [String] })
  leadNotificationEmails?: string[]

  @Prop({ type: [String] })
  leadReportEmails?: string[]

  @Prop()
  enableRespondentNotification?: boolean

  @Prop()
  respondentNotificationSubject?: string

  @Prop()
  respondentNotificationMessage?: string

  @Prop()
  respondentNegativeNotificationSubject?: string

  @Prop()
  respondentNegativeNotificationMessage?: string

  @Prop()
  enableLeadReport?: boolean

  @Prop()
  leadReportFrequency?: string

  @Prop()
  leadReportRangeDays?: number

  @Prop()
  leadReportSubject?: string

  @Prop()
  leadReportMessage?: string

  @Prop()
  leadReportLastSentAt?: number

  @Prop()
  reportingTimezone?: string

  @Prop()
  enableGoogleSheetsLeadSync?: boolean

  @Prop({ type: Object })
  googleSheetsLeadConfig?: Record<string, any>

  @Prop()
  googleSheetsLeadLastDeliveryAt?: number

  @Prop()
  googleSheetsLeadLastDeliveryStatus?: string

  @Prop()
  googleSheetsLeadLastDeliveryMessage?: string

  /**
   * Attach references to the project model for easy query,
   * will not be used as a column in the project schema
   */
  members?: string[]

  // Form count
  formCount?: number

  // If the user is team owner
  isOwner?: boolean
}

export const ProjectSchema = SchemaFactory.createForClass(ProjectModel)

ProjectSchema.index({ teamId: 1, launchPath: 1 }, { unique: true, sparse: true })
