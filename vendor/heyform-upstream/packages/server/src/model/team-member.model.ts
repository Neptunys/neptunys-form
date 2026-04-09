import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export enum TeamRoleEnum {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  COLLABORATOR = 'COLLABORATOR',
  MEMBER = 'MEMBER'
}

@Schema()
export class TeamMemberModel extends Document {
  @Prop({ required: true, index: true })
  teamId: string

  @Prop({ required: true, index: true })
  memberId: string

  @Prop({ type: String, required: true, enum: Object.values(TeamRoleEnum) })
  role: TeamRoleEnum

  @Prop({ default: 0 })
  lastSeenAt?: number
}

export const TeamMemberSchema = SchemaFactory.createForClass(TeamMemberModel)

TeamMemberSchema.index({ teamId: 1, memberId: 1 }, { unique: true })
