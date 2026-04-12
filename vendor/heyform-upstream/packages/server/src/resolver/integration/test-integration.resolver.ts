import { BadRequestException } from '@nestjs/common'

import { Auth, FormGuard } from '@decorator'
import { TestIntegrationInput } from '@graphql'
import { helper } from '@heyform-inc/utils'
import { Args, Mutation, Resolver } from '@nestjs/graphql'
import { AppService, FormService } from '@service'

@Resolver()
@Auth()
export class TestIntegrationResolver {
  constructor(
    private readonly appService: AppService,
    private readonly formService: FormService
  ) {}

  @Mutation(returns => Boolean)
  @FormGuard()
  async testIntegration(
    @Args('input')
    input: TestIntegrationInput
  ): Promise<boolean> {
    const app = this.appService.findById(input.appId)

    if (!app) {
      throw new BadRequestException('Invalid app')
    }

    if (helper.isEmpty(input.config)) {
      throw new BadRequestException('Invalid attributes arguments')
    }

    if (typeof app.test !== 'function') {
      throw new BadRequestException(`${app.name} does not support test runs`)
    }

    const form = await this.formService.findById(input.formId)

    if (!form) {
      throw new BadRequestException('Form not found')
    }

    await app.test({
      config: input.config,
      form
    })

    return true
  }
}