import { Auth, FormGuard, Team } from '@decorator'
import {
  FormDetailInput,
  FormType,
  PublicRenderInput,
  PublicRenderType,
  PublicFormRouteInput,
  PublicFormType,
  PublicRouteType
} from '@graphql'
import { date, helper } from '@heyform-inc/utils'
import { FormModel, IntegrationStatusEnum, TeamModel } from '@model'
import { Args, Context, Query, Resolver } from '@nestjs/graphql'
import {
  ExperimentService,
  FormService,
  IntegrationService,
  ProjectService,
  SubmissionService
} from '@service'

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
    private readonly integrationService: IntegrationService,
    private readonly projectService: ProjectService,
    private readonly experimentService: ExperimentService
  ) {}

  private async buildPublicFormResponse(formId: string): Promise<PublicFormType> {
    const form = await this.formService.findPublicForm(formId)

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
      const rows = await this.integrationService.findAllInFormByApps(formId, [
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
              const pixelId = String(row.config.pixelId).trim()

              if (helper.isValid(pixelId)) {
                integrations.metapixel = pixelId
              }
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
      slug: form.slug,
      isDomainRoot: form.isDomainRoot,
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

  @Query(returns => PublicFormType)
  async publicForm(@Args('input') input: FormDetailInput): Promise<PublicFormType> {
    return this.buildPublicFormResponse(input.formId)
  }

  @Query(returns => PublicFormType)
  async publicFormByDomain(@Args('input') input: PublicFormRouteInput): Promise<PublicFormType> {
    const resolvedForm = await this.formService.resolvePublicFormByDomain(input.hostname, input.slug)

    if (!resolvedForm) {
      throw new Error('Form not found')
    }

    return this.buildPublicFormResponse(resolvedForm.id)
  }

  @Query(returns => PublicRouteType)
  async publicRouteByDomain(@Args('input') input: PublicFormRouteInput): Promise<PublicRouteType> {
    const resolvedRoute = await this.projectService.resolvePublicRouteByDomain(
      input.hostname,
      input.slug
    )

    if (!resolvedRoute) {
      throw new Error('Form not found')
    }

    return resolvedRoute
  }

  @Query(returns => PublicRenderType)
  async publicRender(
    @Context() context: any,
    @Args('input') input: PublicRenderInput
  ): Promise<PublicRenderType> {
    let resolvedFormId = input.formId
    let resolvedExperimentId = input.experimentId

    if (!resolvedFormId && helper.isValid(input.hostname)) {
      if (helper.isValid(input.slug)) {
        const resolvedRoute = await this.projectService.resolvePublicRouteByDomain(
          input.hostname!,
          input.slug
        )

        if (resolvedRoute?.kind === 'form' && resolvedRoute.formId) {
          resolvedFormId = resolvedRoute.formId
        }

        if (resolvedRoute?.kind === 'experiment' && resolvedRoute.experimentId) {
          resolvedExperimentId = resolvedRoute.experimentId
        }
      }

      if (!resolvedFormId && !resolvedExperimentId) {
        const resolvedForm = await this.formService.resolvePublicFormByDomain(input.hostname!, input.slug)

        if (resolvedForm) {
          resolvedFormId = resolvedForm.id
        }
      }
    }

    if (!resolvedFormId && resolvedExperimentId) {
      const anonymousId = context?.req?.get('x-anonymous-id')
      const resolvedExperiment = await this.experimentService.resolvePublicExperiment(
        resolvedExperimentId,
        anonymousId,
        input.previewVariantFormId
      )

      resolvedFormId = resolvedExperiment.formId
      resolvedExperimentId = resolvedExperiment.experimentId
    }

    if (!resolvedFormId) {
      throw new Error('Form not found')
    }

    return {
      form: await this.buildPublicFormResponse(resolvedFormId),
      experimentId: resolvedExperimentId
    }
  }
}
