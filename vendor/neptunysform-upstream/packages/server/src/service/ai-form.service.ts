import {
  ChoiceBadgeEnum,
  FieldKindEnum,
  FormField,
  FormKindEnum
} from '@neptunysform-inc/shared-types-enums'
import { BadRequestException, Injectable } from '@nestjs/common'
import { OpenAI } from 'openai'

import { OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_GPT_MODEL } from '@environments'
import { htmlUtils } from '@neptunysform-inc/answer-utils'
import { helper, nanoid } from '@neptunysform-inc/utils'

interface AIQuestionPlan {
  type?: string
  title?: string
  description?: string
  required?: boolean
  allowMultiple?: boolean
  options?: string[]
  correctOption?: string
}

interface AIScreenPlan {
  title?: string
  description?: string
  buttonText?: string
}

interface AIFormPlan {
  name?: string
  kind?: string
  welcome?: AIScreenPlan
  questions?: AIQuestionPlan[]
  thankYou?: AIScreenPlan
}

interface GeneratedFormDraft {
  name: string
  kind: FormKindEnum
  fields: FormField[]
}

const MIN_QUESTION_COUNT = 3
const MAX_QUESTION_COUNT = 8

const AI_TYPE_TO_FIELD_KIND: Record<string, FieldKindEnum> = {
  short_text: FieldKindEnum.SHORT_TEXT,
  long_text: FieldKindEnum.LONG_TEXT,
  email: FieldKindEnum.EMAIL,
  phone_number: FieldKindEnum.PHONE_NUMBER,
  number: FieldKindEnum.NUMBER,
  multiple_choice: FieldKindEnum.MULTIPLE_CHOICE,
  yes_no: FieldKindEnum.YES_NO
}

@Injectable()
export class AIFormService {
  async createDraft(topic: string, reference?: string): Promise<GeneratedFormDraft> {
    if (!helper.isValid(topic?.trim())) {
      throw new BadRequestException('A topic is required to generate a form.')
    }

    const plan = await this.generatePlan(topic.trim(), reference?.trim())
    const name = this.resolveName(plan.name, topic)
    const kind = this.resolveFormKind(plan.kind)
    const questions = this.ensureQuestionFlow(this.normalizeQuestions(plan.questions), kind)

    return {
      name,
      kind,
      fields: [
        this.createWelcomeField(plan.welcome, name, kind),
        ...questions.map((question, index) => this.createQuestionField(question, kind, index)),
        this.createThankYouField(kind, plan.thankYou)
      ]
    }
  }

  private async generatePlan(topic: string, reference?: string): Promise<AIFormPlan> {
    const openai = this.createClient()
    const { choices } = await openai.chat.completions.create({
      model: OPENAI_GPT_MODEL,
      response_format: {
        type: 'json_object'
      },
      temperature: 0.4,
      max_tokens: 1800,
      messages: [
        {
          role: 'system',
          content:
            'You create valid JSON blueprints for NeptunysForm. Return exactly one JSON object with keys name, kind, welcome, questions, and thankYou. kind must be one of survey, contact, quiz. welcome and thankYou must be objects with title and description, and welcome may include buttonText. questions must be an array of 3 to 8 items. Each question must contain type and title. type must be one of short_text, long_text, email, phone_number, number, multiple_choice, yes_no. Only multiple_choice questions may include options, and they must have 2 to 6 distinct options. yes_no questions should not include options. If kind is quiz and a question is multiple_choice or yes_no, include correctOption with the exact correct option label. Match the language used in the topic or reference. Do not return markdown, comments, or prose.'
        },
        {
          role: 'user',
          content: JSON.stringify({
            topic,
            reference: reference || null,
            goals: [
              'Create a complete respondent flow with a short welcome, cohesive questions, and a clear thank-you ending.',
              'Keep question titles concise and natural.',
              'If kind is contact, include at least one contact method question near the end.',
              'Prefer practical answer formats over decorative screens.',
              'Use email or phone questions only when they are actually useful.',
              'Return clean JSON only.'
            ]
          })
        }
      ]
    })

    const content = choices?.[0]?.message?.content

    if (!helper.isValid(content)) {
      throw new BadRequestException('The AI service did not return a valid form plan.')
    }

    try {
      return JSON.parse(content)
    } catch {
      throw new BadRequestException('The AI service returned malformed JSON for the form plan.')
    }
  }

  private createClient() {
    if (!helper.isValid(OPENAI_API_KEY)) {
      throw new BadRequestException('AI form generation is not configured. Set OPENAI_API_KEY.')
    }

    return new OpenAI({
      apiKey: OPENAI_API_KEY,
      baseURL: OPENAI_BASE_URL
    })
  }

  private resolveName(name: string | undefined, topic: string) {
    const value = helper.isValid(name?.trim()) ? name!.trim() : topic.trim()

    return value.slice(0, 80)
  }

  private resolveFormKind(kind?: string) {
    switch ((kind || '').trim().toLowerCase()) {
      case 'contact':
        return FormKindEnum.CONTACT
      case 'quiz':
        return FormKindEnum.QUIZ
      default:
        return FormKindEnum.SURVEY
    }
  }

  private normalizeQuestions(questions?: AIQuestionPlan[]) {
    const normalized = (questions || [])
      .map(question => ({
        ...question,
        type: (question.type || '').trim().toLowerCase(),
        title: question.title?.trim(),
        description: question.description?.trim(),
        options: (question.options || [])
          .map(option => option?.trim())
          .filter((option): option is string => helper.isValid(option))
      }))
      .filter(question => helper.isValid(question.title))
      .slice(0, MAX_QUESTION_COUNT)

    if (normalized.length < MIN_QUESTION_COUNT) {
      throw new BadRequestException('The AI service did not generate enough valid questions.')
    }

    return normalized
  }

  private ensureQuestionFlow(questions: AIQuestionPlan[], formKind: FormKindEnum) {
    const normalized = [...questions]

    if (
      formKind === FormKindEnum.CONTACT &&
      !normalized.some(question => question.type === 'email' || question.type === 'phone_number')
    ) {
      const contactQuestion: AIQuestionPlan = {
        type: 'email',
        title: 'What is your email address?',
        description: 'We will use this to follow up with you.',
        required: true
      }

      if (normalized.length >= MAX_QUESTION_COUNT) {
        normalized[normalized.length - 1] = contactQuestion
      } else {
        normalized.push(contactQuestion)
      }
    }

    return normalized
  }

  private createWelcomeField(
    screen: AIScreenPlan | undefined,
    formName: string,
    formKind: FormKindEnum
  ): FormField {
    const defaults = this.getWelcomeContent(formName, formKind)
    const buttonText = screen?.buttonText?.trim()

    return {
      id: nanoid(12),
      kind: FieldKindEnum.WELCOME,
      title: htmlUtils.parse(this.resolveScreenText(screen?.title, defaults.title, 120)),
      description: htmlUtils.parse(
        this.resolveScreenText(screen?.description, defaults.description, 240)
      ),
      properties: helper.isValid(buttonText)
        ? {
            buttonText: buttonText.slice(0, 24)
          }
        : {}
    }
  }

  private createQuestionField(question: AIQuestionPlan, formKind: FormKindEnum, index: number): FormField {
    const kind = this.resolveQuestionKind(question.type)
    const field: FormField = {
      id: nanoid(12),
      kind,
      title: htmlUtils.parse(question.title!),
      description: helper.isValid(question.description) ? htmlUtils.parse(question.description!) : undefined,
      validations: {
        required: question.required !== false
      },
      properties: {}
    }

    if (kind === FieldKindEnum.MULTIPLE_CHOICE) {
      const options = this.resolveOptions(question.options)

      field.properties = {
        allowMultiple: formKind !== FormKindEnum.QUIZ && helper.isTrue(question.allowMultiple),
        verticalAlignment: true,
        badge: ChoiceBadgeEnum.LETTER,
        choices: options.map(option => {
          const isExpected = formKind === FormKindEnum.QUIZ && this.isExpectedOption(option, question.correctOption)

          return {
            id: nanoid(12),
            label: option,
            ...(formKind === FormKindEnum.QUIZ && {
              score: isExpected ? 1 : 0,
              isExpected
            })
          }
        })
      }
    }

    if (kind === FieldKindEnum.YES_NO) {
      const options = ['Yes', 'No']

      field.properties = {
        choices: options.map(option => {
          const isExpected = formKind === FormKindEnum.QUIZ && this.isExpectedOption(option, question.correctOption)

          return {
            id: nanoid(12),
            label: option,
            ...(formKind === FormKindEnum.QUIZ && {
              score: isExpected ? 1 : 0,
              isExpected
            })
          }
        })
      }
    }

    if (kind === FieldKindEnum.PHONE_NUMBER) {
      field.properties = {
        ...field.properties,
        defaultCountryCode: 'US'
      }
    }

    if (kind === FieldKindEnum.LONG_TEXT && index === 0 && !helper.isValid(question.description)) {
      field.description = htmlUtils.parse('Share as much detail as you need.')
    }

    return field
  }

  private createThankYouField(formKind: FormKindEnum, screen?: AIScreenPlan): FormField {
    const defaults = this.getThankYouContent(formKind)

    return {
      id: nanoid(12),
      kind: FieldKindEnum.THANK_YOU,
      title: htmlUtils.parse(this.resolveScreenText(screen?.title, defaults.title, 120)),
      description: htmlUtils.parse(
        this.resolveScreenText(screen?.description, defaults.description, 240)
      ),
      properties: {}
    }
  }

  private getWelcomeContent(formName: string, formKind: FormKindEnum) {
    switch (formKind) {
      case FormKindEnum.CONTACT:
        return {
          title: formName,
          description:
            'Share a few details and the best way to reach you. We will follow up with the next step.'
        }
      case FormKindEnum.QUIZ:
        return {
          title: formName,
          description: 'Answer a few quick questions and see how you do.'
        }
      default:
        return {
          title: formName,
          description: 'Answer a few quick questions. It should only take a minute.'
        }
    }
  }

  private getThankYouContent(formKind: FormKindEnum) {
    switch (formKind) {
      case FormKindEnum.CONTACT:
        return {
          title: 'Thanks, you are all set.',
          description: 'We have your details and will get back to you soon.'
        }
      case FormKindEnum.QUIZ:
        return {
          title: 'Thanks for taking the quiz.',
          description: 'Your responses have been recorded.'
        }
      default:
        return {
          title: 'Thank you!',
          description: 'Your responses have been recorded.'
        }
    }
  }

  private resolveScreenText(value: string | undefined, fallback: string, maxLength: number) {
    return helper.isValid(value?.trim()) ? value!.trim().slice(0, maxLength) : fallback
  }

  private resolveQuestionKind(type?: string) {
    return AI_TYPE_TO_FIELD_KIND[type || ''] || FieldKindEnum.SHORT_TEXT
  }

  private resolveOptions(options?: string[]) {
    const values = Array.from(new Set((options || []).filter(Boolean))).slice(0, 6)

    if (values.length >= 2) {
      return values
    }

    return ['Option 1', 'Option 2']
  }

  private isExpectedOption(option: string, correctOption?: string) {
    return option.trim().toLowerCase() === (correctOption || '').trim().toLowerCase()
  }
}