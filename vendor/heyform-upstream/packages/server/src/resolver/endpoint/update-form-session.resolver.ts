import { BadRequestException, UseGuards } from '@nestjs/common'

import { UpdateFormSessionInput } from '@graphql'
import { EndpointAnonymousIdGuard } from '@guard'
import { helper } from '@heyform-inc/utils'
import { Args, Mutation, Resolver } from '@nestjs/graphql'
import { EndpointService, FormSessionService, FormService } from '@service'

@Resolver()
@UseGuards(EndpointAnonymousIdGuard)
export class UpdateFormSessionResolver {
  constructor(
    private readonly endpointService: EndpointService,
    private readonly formService: FormService,
    private readonly formSessionService: FormSessionService
  ) {}

  @Mutation(returns => Boolean)
  async updateFormSession(@Args('input') input: UpdateFormSessionInput): Promise<boolean> {
    const form = await this.formService.findById(input.formId)

    if (!form) {
      throw new BadRequestException('The form does not exist')
    }

    const { sessionId } = this.endpointService.decryptToken(input.openToken)

    if (!helper.isValid(sessionId)) {
      throw new BadRequestException('Invalid form token')
    }

    return this.formSessionService.update({
      sessionId,
      formId: input.formId,
      metrics: input.metrics,
      lastQuestionId: input.lastQuestionId,
      lastQuestionOrder: input.lastQuestionOrder
    })
  }
}