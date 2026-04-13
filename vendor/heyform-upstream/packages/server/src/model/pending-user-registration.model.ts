import { SocialLoginTypeEnum } from '@heyform-inc/shared-types-enums'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

import { nanoid } from '@heyform-inc/utils'

@Schema({
  timestamps: true
})
export class PendingUserRegistrationModel extends Document {
  @Prop({ default: () => nanoid(12) })
  _id: string

  @Prop({ required: true, unique: true, index: true })
  email: string

  @Prop({ required: true })
  name: string

  @Prop()
  password?: string

  @Prop()
  avatar?: string

  @Prop()
  lang?: string

  @Prop({ required: true, unique: true, index: true })
  approvalToken: string

  @Prop({ type: String, enum: Object.values(SocialLoginTypeEnum) })
  socialKind?: SocialLoginTypeEnum

  @Prop()
  socialOpenId?: string

  @Prop({ default: false })
  isEmailVerified?: boolean

  @Prop({ default: 0 })
  requestedAt?: number
}

export const PendingUserRegistrationSchema = SchemaFactory.createForClass(
  PendingUserRegistrationModel
)

PendingUserRegistrationSchema.index({ socialKind: 1, socialOpenId: 1 }, { unique: true, sparse: true })