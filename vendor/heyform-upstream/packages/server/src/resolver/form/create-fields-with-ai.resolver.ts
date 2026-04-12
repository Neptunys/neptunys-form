import { Auth, FormGuard } from '@decorator'
import { CreateFieldsWithAIInput } from '@graphql'
import { Args, Mutation, Resolver } from '@nestjs/graphql'
import { AIFormService } from '@service'
import GraphQLJSON from 'graphql-type-json'

@Resolver()
@Auth()
export class CreateFieldsWithAIResolver {
  constructor(private readonly aiFormService: AIFormService) {}

  @Mutation(returns => GraphQLJSON)
  @FormGuard()
  async createFieldsWithAI(@Args('input') input: CreateFieldsWithAIInput): Promise<Record<string, any>> {
    const draft = await this.aiFormService.createDraft(input.prompt, input.reference)

    return {
      name: draft.name,
      kind: draft.kind,
      drafts: draft.fields
    }
  }
}