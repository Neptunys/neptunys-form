import {
  Answer,
  CaptchaKindEnum,
  SubmissionCategoryEnum,
  SubmissionStatusEnum,
  Variable
} from '@heyform-inc/shared-types-enums'
import { BadRequestException, UseGuards } from '@nestjs/common'

import { CaptureLeadSubmissionInput } from '@graphql'
import { EndpointAnonymousIdGuard } from '@guard'
import { applyLogicToFields, fieldValuesToAnswers, flattenFields } from '@heyform-inc/answer-utils'
import { helper, timestamp } from '@heyform-inc/utils'
import { Args, Mutation, Resolver } from '@nestjs/graphql'
import { EndpointService, FormService, FormSessionService, SubmissionService } from '@service'
import { buildLeadCapturePayload, ClientInfo, GqlClient } from '@utils'

@Resolver()
@UseGuards(EndpointAnonymousIdGuard)
export class CaptureLeadSubmissionResolver {
  constructor(
    private readonly endpointService: EndpointService,
    private readonly formService: FormService,
    private readonly formSessionService: FormSessionService,
    private readonly submissionService: SubmissionService
  ) {}

  @Mutation(returns => Boolean)
  async captureLeadSubmission(
    @GqlClient() client: ClientInfo,
    @Args('input') input: CaptureLeadSubmissionInput
  ): Promise<boolean> {
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

    if (form.settings.requirePassword) {
      const { password } = this.endpointService.decryptToken(input.passwordToken)

      if (password !== form.settings.password) {
        throw new BadRequestException('The password does not match')
      }
    }

    if (form.settings?.captchaKind === CaptchaKindEnum.GOOGLE_RECAPTCHA) {
      // Lead capture runs as a quiet autosave once the respondent provides contact info.
      // The actual anti-bot gate still happens on the final submission path.
    }

    const { timestamp: startAt, sessionId } = this.endpointService.decryptToken(input.openToken)

    if (!helper.isValid(sessionId)) {
      throw new BadRequestException('Invalid form token')
    }

    const session = await this.formSessionService.findBySessionId(sessionId, input.formId)

    if (!session || session.status !== 'active') {
      return false
    }

    let answers: Answer[] = []
    let variables: Variable[] = []

    try {
      const { fields, variables: variableValues } = applyLogicToFields(
        flattenFields(form.fields, true),
        form.logics,
        form.variables,
        input.answers
      )

      answers = fieldValuesToAnswers(fields, input.answers, true)
      variables = form.variables?.map(variable => ({
        ...variable,
        value: variableValues[variable.id]
      }))
    } catch (err) {
      throw new BadRequestException(err.response)
    }

    const now = timestamp()
    const leadPayload = buildLeadCapturePayload(
      form as any,
      {
        id: sessionId,
        answers,
        hiddenFields: input.hiddenFields || [],
        variables,
        endAt: now
      } as any
    )

    if (helper.isEmpty(leadPayload.respondentEmail) && helper.isEmpty(leadPayload.respondentPhone)) {
      return false
    }

    const submissionStatus = helper.isFalse(form.settings?.allowArchive)
      ? SubmissionStatusEnum.PRIVATE
      : SubmissionStatusEnum.PUBLIC

    await this.submissionService.upsertPartialLeadSubmission({
      formId: form.id,
      sessionId,
      title: form.name,
      answers,
      hiddenFields: input.hiddenFields || [],
      variables,
      startAt,
      endAt: now,
      ip: client.ip,
      userAgent: client.userAgent,
      category: SubmissionCategoryEnum.INBOX,
      status: submissionStatus
    })

    return true
  }
}