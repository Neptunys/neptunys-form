import { CaptchaKindEnum, FormStatusEnum, InteractiveModeEnum } from '@neptunysform-inc/shared-types-enums'

import { DEFAULT_FORM_CAPTCHA_KIND, DEFAULT_FORM_FILTER_SPAM } from '@environments'
import { Auth, ProjectGuard, Team, User } from '@decorator'
import { CreateFormWithAIInput } from '@graphql'
import { TeamModel, UserModel } from '@model'
import { Args, Mutation, Resolver } from '@nestjs/graphql'
import { AIFormService, FormService } from '@service'

@Resolver()
@Auth()
export class CreateFormWithAIResolver {
  constructor(
    private readonly aiFormService: AIFormService,
    private readonly formService: FormService
  ) {}

  @Mutation(returns => String)
  @ProjectGuard()
  async createFormWithAI(
    @Team() team: TeamModel,
    @User() user: UserModel,
    @Args('input') input: CreateFormWithAIInput
  ): Promise<string> {
    const draft = await this.aiFormService.createDraft(input.topic, input.reference)

    return await this.formService.create({
      teamId: team.id,
      memberId: user.id,
      projectId: input.projectId,
      name: draft.name,
      interactiveMode: InteractiveModeEnum.GENERAL,
      kind: draft.kind,
      fields: [],
      _drafts: JSON.stringify(draft.fields),
      fieldsUpdatedAt: 0,
      settings: {
        active: false,
        captchaKind: DEFAULT_FORM_CAPTCHA_KIND || CaptchaKindEnum.NONE,
        filterSpam: DEFAULT_FORM_FILTER_SPAM,
        allowArchive: true,
        requirePassword: false,
        locale: 'en',
        enableQuestionNumbers: true,
        enableQuestionList: true,
        enableNavigationArrows: true,
        enableEmailNotification: true
      },
      hiddenFields: [],
      version: 0,
      status: FormStatusEnum.NORMAL
    })
  }
}