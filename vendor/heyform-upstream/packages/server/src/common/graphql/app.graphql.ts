import { Field, ObjectType } from '@nestjs/graphql'
import GraphQLJSON from 'graphql-type-json'

@ObjectType()
export class AppSettingType {
  @Field()
  type: string

  @Field()
  name: string

  @Field()
  label: string

  @Field({ nullable: true })
  description?: string

  @Field({ nullable: true })
  placeholder?: string

  @Field(type => GraphQLJSON, { nullable: true })
  options?: Array<Record<string, any>>

  @Field(type => GraphQLJSON, { nullable: true })
  defaultValue?: any

  @Field()
  required: boolean
}

@ObjectType()
export class AppType {
  @Field({ nullable: true })
  id: string

  @Field()
  name: string

  @Field({ nullable: true })
  description?: string

  @Field({ nullable: true })
  icon?: string

  @Field(type => [AppSettingType], { nullable: true })
  settings?: AppSettingType[]
}
