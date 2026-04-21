import { HiddenFieldAnswer } from '@neptunysform-inc/shared-types-enums'

import { axios, getAnonymousId } from '../utils/axios'

const OPEN_FORM_GQL = `query openForm($input: OpenFormInput!) {
  openForm(input: $input)
}`

const UPDATE_FORM_SESSION_GQL = `mutation updateFormSession($input: UpdateFormSessionInput!) {
  updateFormSession(input: $input)
}`

const VERIFY_FORM_PASSWORD_GQL = `query verifyFormPassword($input: VerifyPasswordInput!) {
  verifyFormPassword(input: $input)
}`

const UPLOAD_FILE_TOKEN_GQL = `mutation uploadFileToken($input: UploadFormFileInput!) {
  uploadFileToken(input: $input) {
    token
    urlPrefix
    key
  }
}`

const COMPLETE_SUBMISSION_GQL = `mutation completeSubmission($input: CompleteSubmissionInput!) {
	completeSubmission(input: $input) {
	  clientSecret
	}
}`

const CAPTURE_LEAD_SUBMISSION_GQL = `mutation captureLeadSubmission($input: CaptureLeadSubmissionInput!) {
  captureLeadSubmission(input: $input)
}`

export class EndpointService {
  static async openForm(input: {
    formId: string
    experimentId?: string
    variantFormId?: string
    landingUrl?: string
    referrer?: string
    utmSource?: string
    utmMedium?: string
    utmCampaign?: string
    utmTerm?: string
    utmContent?: string
  }): Promise<string> {
    const result = await axios({
      query: OPEN_FORM_GQL,
      variables: {
        input
      }
    })
    return result.openForm
  }

  static async updateFormSession(input: {
    formId: string
    openToken: string
    metrics: Array<{
      questionId: string
      order: number
      title?: string
      views: number
      totalDurationMs: number
      completed: boolean
    }>
    lastQuestionId?: string
    lastQuestionOrder?: number
  }, options?: { keepalive?: boolean }): Promise<boolean> {
    if (options?.keepalive && typeof fetch === 'function') {
      const response = await fetch('/graphql', {
        method: 'POST',
        keepalive: true,
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-Anonymous-ID': getAnonymousId()
        },
        body: JSON.stringify({
          query: UPDATE_FORM_SESSION_GQL,
          variables: {
            input
          }
        })
      }).catch(() => undefined)

      if (!response?.ok) {
        return false
      }

      const payload = await response.json().catch(() => undefined)

      if (Array.isArray(payload?.errors)) {
        return false
      }

      return payload?.data?.updateFormSession === true
    }

    const result = await axios({
      query: UPDATE_FORM_SESSION_GQL,
      variables: {
        input
      }
    })

    return result.updateFormSession
  }

  static async verifyFormPassword(formId: string, password: string): Promise<string> {
    const result = await axios({
      query: VERIFY_FORM_PASSWORD_GQL,
      variables: {
        input: {
          formId,
          password
        }
      }
    })
    return result.verifyFormPassword
  }

  static async uploadFileToken(
    formId: string,
    filename: string,
    mime: string
  ): Promise<{
    token: string
    urlPrefix: string
    key: string
  }> {
    const result = await axios({
      query: UPLOAD_FILE_TOKEN_GQL,
      variables: {
        input: {
          formId,
          filename,
          mime
        }
      }
    })
    return result.uploadFileToken
  }

  static async completeSubmission(input: {
    formId: string
    contactId?: string
    openToken: string
    passwordToken?: string
    answers: Record<string, Any>
    hiddenFields: HiddenFieldAnswer[]
    // Google reCAPTCHA token
    recaptchaToken?: string
    partialSubmission?: boolean
  }): Promise<{ clientSecret?: string }> {
    const result = await axios({
      query: COMPLETE_SUBMISSION_GQL,
      variables: {
        input
      }
    })
    return result.completeSubmission
  }

  static async captureLeadSubmission(input: {
    formId: string
    openToken: string
    passwordToken?: string
    answers: Record<string, Any>
    hiddenFields?: HiddenFieldAnswer[]
  }): Promise<boolean> {
    const result = await axios({
      query: CAPTURE_LEAD_SUBMISSION_GQL,
      variables: {
        input
      }
    })

    return result.captureLeadSubmission === true
  }
}
