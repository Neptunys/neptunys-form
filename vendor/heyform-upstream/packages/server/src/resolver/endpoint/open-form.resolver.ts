import { BadRequestException, UseGuards } from '@nestjs/common'

import { FORM_ENCRYPTION_KEY } from '@environments'
import { OpenFormInput } from '@graphql'
import { EndpointAnonymousIdGuard } from '@guard'
import { timestamp } from '@heyform-inc/utils'
import { Args, Context, Query, Resolver } from '@nestjs/graphql'
import { FormAnalyticService, FormService, FormSessionService } from '@service'
import { aesEncryptObject } from '@utils'

@Resolver()
@UseGuards(EndpointAnonymousIdGuard)
export class OpenFormResolver {
  constructor(
    private readonly formService: FormService,
    private readonly formAnalyticService: FormAnalyticService,
    private readonly formSessionService: FormSessionService
  ) {}

  @Query(returns => String)
  async openForm(@Context() context: any, @Args('input') input: OpenFormInput): Promise<string> {
    const form = await this.formService.findById(input.formId)

    if (!form) {
      throw new BadRequestException('The form does not exist')
    }

    if (form.suspended) {
      throw new BadRequestException('The form is suspended')
    }

    if (form.settings.active !== true) {
      throw new BadRequestException('The form does not active')
    }

    const anonymousId = context?.req?.get('x-anonymous-id')
    const { sessionId, isNewSession } = await this.formSessionService.create({
      formId: form.id,
      projectId: form.projectId,
      teamId: form.teamId,
      anonymousId,
      experimentId: input.experimentId,
      variantFormId: input.variantFormId || form.id,
      source: {
        landingUrl: input.landingUrl,
        referrer: input.referrer,
        utmSource: input.utmSource,
        utmMedium: input.utmMedium,
        utmCampaign: input.utmCampaign,
        utmTerm: input.utmTerm,
        utmContent: input.utmContent
      }
    })

    if (isNewSession) {
      await this.formAnalyticService.updateTotalVisits(form.id)
    }

    return aesEncryptObject(
      {
        timestamp: timestamp(),
        sessionId,
        experimentId: input.experimentId,
        variantFormId: input.variantFormId || form.id
      },
      FORM_ENCRYPTION_KEY
    )
  }
}
