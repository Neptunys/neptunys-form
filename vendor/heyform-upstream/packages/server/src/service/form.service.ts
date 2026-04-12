import {
  CaptchaKindEnum,
  FormField,
  FormKindEnum,
  FormStatusEnum,
  InteractiveModeEnum
} from '@heyform-inc/shared-types-enums'
import { InjectQueue } from '@nestjs/bull'
import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { slugify } from '@heyform-inc/utils'
import { Queue } from 'bull'
import { Model } from 'mongoose'

import { TeamService } from './team.service'
import { GOOGLE_RECAPTCHA_KEY } from '@environments'
import { helper, pickObject, timestamp } from '@heyform-inc/utils'
import { FormModel, ProjectModel } from '@model'
import { mapToObject } from '@utils'
import { getUpdateQuery } from '@utils'

const DEFAULT_PUBLIC_FORM_SLUG = 'form'
const RESERVED_PUBLIC_FORM_SLUGS = new Set([
  'api',
  'dashboard',
  'form',
  'forgot-password',
  'graphql',
  'health',
  'login',
  'logout',
  'oauth',
  'reset-password',
  'sign-up',
  'static',
  'verify-email',
  'workspace',
  'x'
])

function normalizeEnumValue<T extends Record<string, string | number>>(
  enumType: T,
  value: string | number | undefined
) {
  if (value === undefined || value === null) {
    return value
  }

  if (typeof value === 'number') {
    return enumType[value] ?? value
  }

  if (/^\d+$/.test(value)) {
    const numericValue = Number(value)
    return enumType[numericValue] ?? value
  }

  return value
}

function normalizeDomainHostname(value?: string) {
  if (!helper.isValid(value)) {
    return undefined
  }

  return value!
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/:\d+$/, '')
    .replace(/\/.*$/, '')
    .replace(/\.+$/, '')
}

function normalizePublicFormSlug(value?: string) {
  if (!helper.isValid(value)) {
    return undefined
  }

  const normalized = slugify(value!, {
    replacement: '-',
    lower: true,
    strict: true,
    trim: true
  })
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || undefined
}

interface UpdateFiledOptions {
  formId: string
  fieldId: string
  updates: Record<string, any>
}

@Injectable()
export class FormService {
  constructor(
    @InjectModel(FormModel.name)
    private readonly formModel: Model<FormModel>,
    @InjectModel(ProjectModel.name)
    private readonly projectModel: Model<ProjectModel>,
    private readonly teamService: TeamService,
    @InjectQueue('TranslateFormQueue')
    private readonly translateFormQueue: Queue
  ) {}

  async findById(id: string): Promise<FormModel | null> {
    return this.formModel.findById(id)
  }

  async findByIdInTeam(id: string, teamId: string) {
    return this.formModel.findOne({
      _id: id,
      teamId
    })
  }

  async findAllInTeam(teamId: string | string[]): Promise<FormModel[]> {
    const conditions: any = {
      teamId
    }

    if (helper.isValidArray(teamId)) {
      conditions.teamId = {
        $in: teamId
      }
    }

    return this.formModel.find(conditions)
  }

  async findRecentInTeam(
    teamId: string,
    projectIds: string[],
    limit = 10,
    status = FormStatusEnum.NORMAL
  ): Promise<FormModel[]> {
    const normalizedStatus = normalizeEnumValue(FormStatusEnum, status)
    const conditions: Record<string, any> = {
      teamId,
      status: normalizedStatus
    }

    if (helper.isValidArray(projectIds)) {
      conditions.projectId = {
        $in: projectIds
      }
    }

    return this.formModel
      .find(conditions)
      .sort({
        updatedAt: -1
      })
      .limit(limit)
  }

  async searchInTeam(teamId: string, projectIds: string[], keyword: string): Promise<FormModel[]> {
    const conditions: Record<string, any> = {
      teamId,
      name: new RegExp(keyword, 'i')
    }

    if (helper.isValidArray(projectIds)) {
      conditions.projectId = {
        $in: projectIds
      }
    }

    return this.formModel.find(conditions).sort({
      updatedAt: -1
    })
  }

  async findAllInTrash(): Promise<FormModel[]> {
    return this.formModel.find({
      retentionAt: {
        $lte: timestamp(),
        $gt: 0
      },
      status: normalizeEnumValue(FormStatusEnum, FormStatusEnum.TRASH)
    })
  }

  async findAll(
    projectId: string | string[],
    status: FormStatusEnum,
    keyword?: string
  ): Promise<FormModel[]> {
    const normalizedStatus = normalizeEnumValue(FormStatusEnum, status)
    const conditions: any = {
      projectId,
      status: normalizedStatus
    }

    if (helper.isValidArray(projectId)) {
      conditions.projectId = {
        $in: projectId
      }
    }

    if (keyword) {
      conditions.name = new RegExp(keyword, 'i')
    }

    return this.formModel.find(conditions).sort({
      updatedAt: -1
    })
  }

  async findAllByFieldLength(maxLength = 2) {
    return this.formModel.find({
      $where: `this.fields.length <= ${maxLength}`
    })
  }

  public async countMaps(projectIds: string[]): Promise<any> {
    return this.formModel
      .aggregate<FormModel>([
        { $match: { projectId: { $in: projectIds } } },
        { $group: { _id: `$projectId`, count: { $sum: 1 } } }
      ])
      .exec()
  }

  async _internalCountAll() {
    return this.formModel.countDocuments({})
  }

  async countAll(teamId: string): Promise<number> {
    return this.formModel.countDocuments({
      teamId
    })
  }

  async countAllInTeams(teamIds: string[]): Promise<any> {
    return this.formModel
      .aggregate<FormModel>([
        {
          $match: {
            teamId: {
              $in: teamIds
            }
          }
        },
        {
          $group: {
            _id: `$teamId`,
            count: {
              $sum: 1
            }
          }
        }
      ])
      .exec()
  }

  public async create(form: FormModel | any): Promise<string> {
    const publicSlug = await this.buildUniquePublicSlug(form.teamId, form.slug || form.name)
    const shouldOwnRoot = helper.isTrue(form.isDomainRoot)
      ? true
      : (await this.countAll(form.teamId)) === 0

    const result = await this.formModel.create({
      ...form,
      slug: publicSlug,
      isDomainRoot: shouldOwnRoot,
      interactiveMode: normalizeEnumValue(InteractiveModeEnum, form.interactiveMode),
      kind: normalizeEnumValue(FormKindEnum, form.kind),
      status: normalizeEnumValue(FormStatusEnum, form.status)
    })
    return result.id
  }

  public async update(
    formId: string,
    updates: Record<string, any>,
    conditions?: Record<string, any>
  ): Promise<boolean> {
    const result = await this.formModel.updateOne(
      {
        _id: formId,
        ...conditions
      },
      updates
    )
    return result.acknowledged
  }

  public async updateMany(formIds: string[], updates: Record<string, any>): Promise<boolean> {
    const result = await this.formModel.updateMany(
      {
        _id: {
          $in: formIds
        }
      },
      updates
    )
    return result.acknowledged
  }

  public async delete(formId: string | string[]): Promise<boolean> {
    let result: any

    if (helper.isValidArray(formId)) {
      result = await this.formModel.deleteMany({
        _id: {
          $in: formId as string[]
        },
        status: FormStatusEnum.TRASH
      })
    } else {
      result = await this.formModel.deleteOne({
        _id: formId as string,
        status: FormStatusEnum.TRASH
      })
    }

    return (result.deletedCount ?? 0) > 0
  }

  public async createField(formId: string, field: FormField): Promise<boolean> {
    const result = await this.formModel.updateOne(
      {
        _id: formId
      },
      {
        $push: {
          fields: field
        }
      }
    )
    return result.acknowledged
  }

  public async updateField({ formId, fieldId, updates }: UpdateFiledOptions): Promise<boolean> {
    const result = await this.formModel.updateOne(
      {
        _id: formId,
        'fields.id': fieldId
      },
      {
        $set: getUpdateQuery(updates, 'fields.$')
      }
    )
    return result.acknowledged
  }

  public async deleteField(formId: string, fieldId: string): Promise<boolean> {
    const result = await this.formModel.updateOne(
      {
        _id: formId
      },
      {
        $pull: {
          fields: {
            id: fieldId
          }
        }
      },
      {
        // @ts-ignore
        safe: true,
        multi: true
      }
    )
    return result.acknowledged
  }

  async checkQuota(teamId: string, formLimit: number): Promise<boolean> {
    const count = await this.countAll(teamId)

    if (formLimit !== -1 && count >= formLimit) {
      throw new BadRequestException({
        code: 'FORM_QUOTA_EXCEED',
        message: 'The form quota exceeds, new forms are no longer accepted'
      })
    }

    return true
  }

  public async findBySlug(teamId: string, slug: string): Promise<FormModel | null> {
    return this.formModel.findOne({
      teamId,
      slug,
      status: normalizeEnumValue(FormStatusEnum, FormStatusEnum.NORMAL)
    })
  }

  public async findDomainRootForm(teamId: string): Promise<FormModel | null> {
    return this.formModel
      .findOne({
        teamId,
        isDomainRoot: true,
        status: normalizeEnumValue(FormStatusEnum, FormStatusEnum.NORMAL)
      })
      .sort({
        updatedAt: -1
      })
  }

  public async resolvePublicFormByDomain(hostname: string, slug?: string): Promise<FormModel | null> {
    const normalizedHostname = normalizeDomainHostname(hostname)

    if (!helper.isValid(normalizedHostname)) {
      return null
    }

    const team = await this.teamService.findByCustomDomain(normalizedHostname!)

    if (!team) {
      return null
    }

    if (helper.isValid(slug)) {
      const normalizedSlug = normalizePublicFormSlug(slug)

      if (!normalizedSlug) {
        return null
      }

      return this.findBySlug(team.id, normalizedSlug)
    }

    return this.findDomainRootForm(team.id)
  }

  public async buildUniquePublicSlug(
    teamId: string,
    value?: string,
    excludeFormId?: string
  ): Promise<string> {
    const normalizedSlug = normalizePublicFormSlug(value)
    let baseSlug = normalizedSlug || DEFAULT_PUBLIC_FORM_SLUG

    if (RESERVED_PUBLIC_FORM_SLUGS.has(baseSlug)) {
      baseSlug = `${DEFAULT_PUBLIC_FORM_SLUG}-${baseSlug}`
    }

    let candidate = baseSlug
    let counter = 2

    while (
      (await this.formModel.exists({
        teamId,
        slug: candidate,
        ...(excludeFormId
          ? {
              _id: {
                $ne: excludeFormId
              }
            }
          : {})
      })) ||
      (await this.projectModel.exists({
        teamId,
        launchPath: candidate
      }))
    ) {
      candidate = `${baseSlug}-${counter++}`
    }

    return candidate
  }

  public async updatePublicSlug(form: Pick<FormModel, 'id' | 'name' | 'teamId'>, value?: string) {
    const normalizedSlug = normalizePublicFormSlug(value)

    if (!normalizedSlug) {
      const result = await this.formModel.updateOne(
        {
          _id: form.id
        },
        {
          $unset: {
            slug: 1
          }
        }
      )

      return result.acknowledged
    }

    if (RESERVED_PUBLIC_FORM_SLUGS.has(normalizedSlug)) {
      throw new BadRequestException('This public path is reserved. Please choose another one.')
    }

    const projectConflict = await this.projectModel.findOne({
      teamId: form.teamId,
      launchPath: normalizedSlug
    })

    if (projectConflict) {
      throw new BadRequestException('This public path is already used by a project launch page.')
    }

    const existing = await this.formModel.findOne({
      teamId: form.teamId,
      slug: normalizedSlug,
      _id: {
        $ne: form.id
      }
    })

    if (existing) {
      throw new BadRequestException('This public path is already in use in the workspace.')
    }

    const result = await this.formModel.updateOne(
      {
        _id: form.id
      },
      {
        $set: {
          slug: normalizedSlug
        }
      }
    )

    return result.acknowledged
  }

  public async setDomainRoot(form: Pick<FormModel, 'id' | 'teamId'>, isDomainRoot?: boolean) {
    if (helper.isTrue(isDomainRoot)) {
      await this.formModel.updateMany(
        {
          teamId: form.teamId,
          _id: {
            $ne: form.id
          }
        },
        {
          $unset: {
            isDomainRoot: 1
          }
        }
      )

      const result = await this.formModel.updateOne(
        {
          _id: form.id
        },
        {
          $set: {
            isDomainRoot: true
          }
        }
      )

      return result.acknowledged
    }

    const result = await this.formModel.updateOne(
      {
        _id: form.id
      },
      {
        $unset: {
          isDomainRoot: 1
        }
      }
    )

    return result.acknowledged
  }

  public async findPublicForm(formId: string): Promise<Record<string, any> | undefined> {
    const form = await this.findById(formId)

    if (!form || !form.settings.active) {
      return {
        id: formId,
        teamId: form?.teamId,
        projectId: form?.projectId,
        memberId: form?.memberId,
        name: form?.name,
        slug: form?.slug,
        isDomainRoot: form?.isDomainRoot,
        fields: [],
        hiddenFields: [],
        settings: {
          active: false,
          ...pickObject(form?.settings || {}, [
            'enableClosedMessage',
            'closedFormTitle',
            'closedFormDescription'
          ])
        },
        themeSettings: form?.themeSettings
      }
    }

    const now = timestamp()
    if (
      form.settings.enableExpirationDate &&
      (now < form.settings.enabledAt ||
        (now > form.settings.closedAt && form.settings.closedAt > 0))
    ) {
      return {
        id: formId,
        teamId: form.teamId,
        projectId: form.projectId,
        memberId: form.memberId,
        name: form?.name,
        slug: form.slug,
        isDomainRoot: form.isDomainRoot,
        fields: [],
        hiddenFields: [],
        settings: {
          active: false,
          ...pickObject(form?.settings || {}, [
            'enableClosedMessage',
            'closedFormTitle',
            'closedFormDescription'
          ])
        },
        themeSettings: form.themeSettings
      }
    }

    const masked: Record<string, any> = pickObject(form.toObject(), [
      ['_id', 'id'],
      'teamId',
      'projectId',
      'memberId',
      'slug',
      'isDomainRoot',
      'nameSchema',
      'name',
      'interactiveMode',
      'kind',
      'hiddenFields',
      'logics',
      'variables',
      'themeSettings'
    ])

    //!!! Do not disclose form password to the front end
    masked.settings = pickObject(form.settings, [
      'active',
      'enableTimeLimit',
      'timeLimit',
      'captchaKind',
      'requirePassword',
      'enableProgress',
      'progressStyle',
      'autoAdvanceSingleChoice',
      'enableQuestionNumbers',
      'enableQuestionList',
      'enableNavigationArrows',
      'locale',
      'languages',
      'enableClosedMessage',
      'closedFormTitle',
      'closedFormDescription'
    ])

    masked.fields = form.fields.map(field => {
      //!!! Do not disclose scope and other information to the front end
      if (field.properties) {
        field.properties.score = undefined

        if (field.properties.choices) {
          field.properties.choices = field.properties.choices.map(choice => {
            choice.score = undefined
            choice.isExpected = undefined
            return choice
          })
        }
      }

      return field
    })
    masked.translations = mapToObject(form.translations)

    const team = await this.teamService.findById(form.teamId)

    masked.settings.removeBranding = team.removeBranding

    if (form.settings?.captchaKind === CaptchaKindEnum.GOOGLE_RECAPTCHA) {
      masked.settings.googleRecaptchaKey = GOOGLE_RECAPTCHA_KEY
    }

    return masked
  }

  public addTranslateQueue(formId: string, languages: string[]) {
    languages.forEach(language => {
      this.translateFormQueue.add({
        formId,
        language
      })
    })
  }
}
