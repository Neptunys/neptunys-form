import { Auth, FormGuard, Team } from '@decorator'
import { FormDetailInput, FormType, PublicFormType } from '@graphql'
import { date, helper } from '@heyform-inc/utils'
import { FormModel, IntegrationStatusEnum, TeamModel } from '@model'
import { Args, Query, Resolver } from '@nestjs/graphql'
import { FormService, IntegrationService, SubmissionService } from '@service'

const DEFAULT_FORM_NAME = 'Untitled'

@Resolver()
@Auth()
export class FormDetailResolver {
  constructor(
    private readonly formService: FormService,
    private readonly submissionService: SubmissionService
  ) {}

  @Query(returns => FormType)
  @FormGuard()
  async formDetail(
    @Team() team: TeamModel,
    @Args('input') input: FormDetailInput
  ): Promise<FormModel> {
    const [form, submissionCount] = await Promise.all([
      this.formService.findById(input.formId),
      this.submissionService.count({ formId: input.formId })
    ])

    //@ts-ignore
    form.updatedAt = date(form.get('updatedAt')).unix()

    //@ts-ignore
    form.submissionCount = submissionCount

    if (helper.isEmpty(form.name)) {
      form.name = DEFAULT_FORM_NAME
    }

    return form
  }
}

@Resolver()
export class PublicFormResolver {
  constructor(
    private readonly formService: FormService,
    private readonly integrationService: IntegrationService
  ) {}

  @Query(returns => PublicFormType)
  async publicForm(@Args('input') input: FormDetailInput): Promise<PublicFormType> {
    const form = await this.formService.findPublicForm(input.formId)

    if (!form) {
      throw new Error('Form not found')
    }

    if (!form.teamId) {
      throw new Error('Form teamId is required')
    }

    if (!form.projectId) {
      throw new Error('Form projectId is required')
    }

    const integrations: Record<string, any> = {}

    if (form.settings?.active) {
      const rows = await this.integrationService.findAllInFormByApps(input.formId, [
        'googleanalytics4',
        'googletagmanager',
        'metapixel'
      ])

      for (const row of rows) {
        if (row.status !== IntegrationStatusEnum.ACTIVE) {
          continue
        }

        switch (row.appId) {
          case 'googleanalytics4':
            if (helper.isValid(row.config?.measurementId)) {
              integrations.googleanalytics4 = row.config.measurementId
            }
            break

          case 'googletagmanager':
            if (helper.isValid(row.config?.containerId)) {
              integrations.googletagmanager = row.config.containerId
            }
            break

          case 'metapixel':
            if (helper.isValid(row.config?.pixelId)) {
              integrations.metapixel = row.config.pixelId
            }
            break
        }
      }
    }

    return {
      id: form.id,
      teamId: form.teamId,
      projectId: form.projectId,
      memberId: form.memberId,
      name: helper.isEmpty(form.name) ? DEFAULT_FORM_NAME : form.name,
      description: form.description,
      interactiveMode: form.interactiveMode,
      kind: form.kind,
      settings: form.settings,
      drafts: form.drafts || form.fields || [],
      fields: form.fields || [],
      translations: form.translations || {},
      hiddenFields: form.hiddenFields || [],
      logics: form.logics || [],
      variables: form.variables || [],
      fieldsUpdatedAt: form.fieldsUpdatedAt || Date.now(),
      themeSettings: form.themeSettings || {},
      retentionAt: form.retentionAt,
      suspended: form.suspended || false,
      isDraft: form.isDraft || false,
      status: form.status,
      stripeAccount: form.stripeAccount,
      version: form.version || 1,
      canPublish: form.canPublish || false,
      customReport: form.customReport || {
        id: '',
        hiddenFields: [],
        theme: {},
        enablePublicAccess: false
      },
      integrations
    }
  }
}
