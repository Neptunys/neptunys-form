import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

@Schema({
  timestamps: true
})
export class StoredUploadModel extends Document {
  @Prop({ required: true, unique: true, index: true })
  key: string

  @Prop({ required: true })
  originalName: string

  @Prop({ required: true })
  mimeType: string

  @Prop({ required: true })
  size: number

  @Prop({ type: Buffer, required: true })
  content: Buffer
}

export const StoredUploadSchema = SchemaFactory.createForClass(StoredUploadModel)