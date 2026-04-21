import { Auth, FormGuard } from '@decorator'
import { FormDetailInput } from '@graphql'
import { timestamp } from '@neptunysform-inc/utils'
import { Args, Mutation, Resolver } from '@nestjs/graphql'
import { FormService } from '@service'

@Resolver()
@Auth()
export class ResetFormAnalyticsResolver {
  constructor(private readonly formService: FormService) {}

  @Mutation(returns => Boolean)
  @FormGuard()
  async resetFormAnalytics(@Args('input') input: FormDetailInput): Promise<boolean> {
    return this.formService.update(input.formId, {
      'settings.analyticsResetAt': timestamp()
    })
  }
}