import { Auth, Form, FormGuard } from '@decorator'
import { UpdateFormInput } from '@graphql'
import { helper, pickValidValues } from '@neptunysform-inc/utils'
import { FormModel } from '@model'
import { Args, Mutation, Resolver } from '@nestjs/graphql'
import { FormService } from '@service'

@Resolver()
@Auth()
export class UpdateFormResolver {
  constructor(private readonly formService: FormService) {}

  @Mutation(returns => Boolean)
  @FormGuard()
  async updateForm(
    @Form() form: FormModel,
    @Args('input') input: UpdateFormInput
  ): Promise<boolean> {
    let updates: Record<string, any> = pickValidValues(input as any, [
      'name',
      'kind',
      ['active', 'settings.active'],
      ['enableExpirationDate', 'settings.enableExpirationDate'],
      ['expirationTimeZone', 'settings.expirationTimeZone'],
      ['enabledAt', 'settings.enabledAt'],
      ['closedAt', 'settings.closedAt'],
      ['enableTimeLimit', 'settings.enableTimeLimit'],
      ['timeLimit', 'settings.timeLimit'],
      ['captchaKind', 'settings.captchaKind'],
      ['filterSpam', 'settings.filterSpam'],
      ['enableQuotaLimit', 'settings.enableQuotaLimit'],
      ['quotaLimit', 'settings.quotaLimit'],
      ['enableIpLimit', 'settings.enableIpLimit'],
      ['ipLimitCount', 'settings.ipLimitCount'],
      ['ipLimitTime', 'settings.ipLimitTime'],
      ['enableProgress', 'settings.enableProgress'],
      ['progressStyle', 'settings.progressStyle'],
      ['autoAdvanceSingleChoice', 'settings.autoAdvanceSingleChoice'],
      ['enableQuestionNumbers', 'settings.enableQuestionNumbers'],
      ['enableQuestionList', 'settings.enableQuestionList'],
      ['enableNavigationArrows', 'settings.enableNavigationArrows'],
      ['locale', 'settings.locale'],
      ['languages', 'settings.languages'],
      ['enableClosedMessage', 'settings.enableClosedMessage'],
      ['closedFormTitle', 'settings.closedFormTitle'],
      ['closedFormDescription', 'settings.closedFormDescription'],
      ['allowArchive', 'settings.allowArchive'],
      ['password', 'settings.password'],
      ['requirePassword', 'settings.requirePassword'],
      ['enableEmailNotification', 'settings.enableEmailNotification'],
      ['enableLeadScoring', 'settings.enableLeadScoring'],
      ['leadScoreVariableId', 'settings.leadScoreVariableId'],
      ['leadMediumThreshold', 'settings.leadMediumThreshold'],
      ['leadHighThreshold', 'settings.leadHighThreshold'],
      ['leadQualityLowLabel', 'settings.leadQualityLowLabel'],
      ['leadQualityMediumLabel', 'settings.leadQualityMediumLabel'],
      ['leadQualityHighLabel', 'settings.leadQualityHighLabel'],
      ['leadPriorityLowLabel', 'settings.leadPriorityLowLabel'],
      ['leadPriorityMediumLabel', 'settings.leadPriorityMediumLabel'],
      ['leadPriorityHighLabel', 'settings.leadPriorityHighLabel'],
      ['respondentNameFieldId', 'settings.respondentNameFieldId'],
      ['respondentEmailFieldId', 'settings.respondentEmailFieldId'],
      ['respondentPhoneFieldId', 'settings.respondentPhoneFieldId'],
      ['enableRespondentNotification', 'settings.enableRespondentNotification'],
      ['respondentNotificationSubject', 'settings.respondentNotificationSubject'],
      ['respondentNotificationMessage', 'settings.respondentNotificationMessage'],
      ['respondentNegativeNotificationSubject', 'settings.respondentNegativeNotificationSubject'],
      ['respondentNegativeNotificationMessage', 'settings.respondentNegativeNotificationMessage'],
      ['enableOperatorNotification', 'settings.enableOperatorNotification'],
      ['operatorNotificationSubject', 'settings.operatorNotificationSubject'],
      ['operatorNotificationMessage', 'settings.operatorNotificationMessage']
    ])

    if (helper.isTrue(input.redirectOnCompletion)) {
      updates = {
        ...updates,
        ...pickValidValues(input as any, [
          ['redirectOnCompletion', 'settings.redirectOnCompletion'],
          ['redirectUrl', 'settings.redirectUrl'],
          ['redirectDelay', 'settings.redirectDelay']
        ])
      }
    }

    // `pickValidValues` drops empty arrays, but we must persist language updates
    // (including clearing translations to an empty list).
    const hasLanguagesInput =
      Object.prototype.hasOwnProperty.call(input, 'languages') ||
      helper.isNull(input.languages) ||
      helper.isArray(input.languages)

    if (hasLanguagesInput) {
      updates['settings.languages'] = helper.isArray(input.languages) ? input.languages : []
    }

    if (Object.prototype.hasOwnProperty.call(input, 'operatorNotificationEmails')) {
      updates['settings.operatorNotificationEmails'] = helper.isArray(
        input.operatorNotificationEmails
      )
        ? input.operatorNotificationEmails
        : []
    }

    if (Object.prototype.hasOwnProperty.call(input, 'selfEmailRecipients')) {
      updates['settings.selfEmailRecipients'] = helper.isArray(input.selfEmailRecipients)
        ? input.selfEmailRecipients
        : []
    }

    if (
      helper.isValidArray(input.languages) &&
      !input.languages.every(t => form.settings?.languages?.includes(t))
    ) {
      this.formService.addTranslateQueue(input.formId, input.languages!)
    }

    if (input.metaTitle || input.metaDescription || input.metaOGImageUrl) {
      updates = {
        ...updates,
        ...pickValidValues(input as any, [
          ['metaTitle', 'settings.metaTitle'],
          ['metaDescription', 'settings.metaDescription'],
          ['metaOGImageUrl', 'settings.metaOGImageUrl']
        ])
      }
    } else if (helper.isNull(input.metaOGImageUrl)) {
      updates['settings.metaOGImageUrl'] = null
    }

    const tasks = [this.formService.update(input.formId, updates)]

    if (Object.prototype.hasOwnProperty.call(input, 'slug')) {
      tasks.push(this.formService.updatePublicSlug(form, input.slug))
    }

    if (Object.prototype.hasOwnProperty.call(input, 'isDomainRoot')) {
      tasks.push(this.formService.setDomainRoot(form, helper.isTrue(input.isDomainRoot)))
    }

    const results = await Promise.all(tasks)

    return results.every(Boolean)
  }
}
