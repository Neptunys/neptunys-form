import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export enum IntegrationStatusEnum {
  PENDING = 0,
  ACTIVE = 1,
  DISABLED = 2
}

export const INTEGRATION_STATUS_VALUES = Object.values(IntegrationStatusEnum).filter(
  (value): value is IntegrationStatusEnum => typeof value === 'number'
)

export function normalizeIntegrationStatus(status: unknown): IntegrationStatusEnum | undefined {
  if (typeof status === 'number') {
    return INTEGRATION_STATUS_VALUES.includes(status) ? status : undefined
  }

  if (typeof status !== 'string') {
    return undefined
  }

  const normalized = status.trim().toUpperCase()

  if (!normalized) {
    return undefined
  }

  const numeric = Number(normalized)

  if (!Number.isNaN(numeric) && INTEGRATION_STATUS_VALUES.includes(numeric as IntegrationStatusEnum)) {
    return numeric as IntegrationStatusEnum
  }

  const enumValue = IntegrationStatusEnum[normalized as keyof typeof IntegrationStatusEnum]
  return typeof enumValue === 'number' ? enumValue : undefined
}

@Schema({
  timestamps: true
})
export class IntegrationModel extends Document {
  @Prop({ required: true })
  formId: string

  @Prop({ required: true })
  appId: string

  @Prop({ type: Map, default: {} })
  config?: Record<string, any>

  @Prop()
  thirdPartyOauthId?: string

  @Prop({
    type: Number,
    required: true,
    enum: INTEGRATION_STATUS_VALUES,
    set: (value: unknown) => normalizeIntegrationStatus(value) ?? value,
    default: IntegrationStatusEnum.ACTIVE
  })
  status: IntegrationStatusEnum

  @Prop()
  lastDeliveryAt?: number

  @Prop()
  lastDeliveryStatus?: string

  @Prop()
  lastDeliveryMessage?: string
}

export const IntegrationSchema = SchemaFactory.createForClass(IntegrationModel)

IntegrationSchema.index({ formId: 1, appId: 1 }, { unique: true })
