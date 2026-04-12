import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { FormStatusEnum } from '@heyform-inc/shared-types-enums'
import { helper, slugify } from '@heyform-inc/utils'
import { FormModel, ProjectMemberModel, ProjectModel } from '@model'

import { TeamService } from './team.service'

const DEFAULT_PROJECT_LAUNCH_PATH = 'launch'
const RESERVED_PROJECT_LAUNCH_PATHS = new Set([
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

function normalizeProjectLaunchPath(value?: string) {
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

@Injectable()
export class ProjectService {
  constructor(
    @InjectModel(ProjectModel.name)
    private readonly projectModel: Model<ProjectModel>,
    @InjectModel(ProjectMemberModel.name)
    private readonly projectMemberModel: Model<ProjectMemberModel>,
    @InjectModel(FormModel.name)
    private readonly formModel: Model<FormModel>,
    private readonly teamService: TeamService
  ) {}

  async findAllInTeam(teamId: string): Promise<ProjectModel[]> {
    return this.projectModel
      .find({
        teamId
      })
      .sort({
        createdAt: -1
      })
  }

  async findAllBy(conditions: Record<string, any>): Promise<ProjectModel[]> {
    return this.projectModel.find(conditions).sort({
      createdAt: -1
    })
  }

  async findOne(conditions: any) {
    return this.projectModel.findOne(conditions)
  }

  async findById(id: string): Promise<ProjectModel | null> {
    return this.projectModel.findById(id)
  }

  async findByIds(ids: string[], conditions?: Record<string, any>): Promise<ProjectModel[]> {
    return this.projectModel
      .find({
        _id: {
          $in: ids
        },
        ...conditions
      })
      .sort({
        createdAt: -1
      })
  }

  async findByLaunchPath(teamId: string, launchPath: string): Promise<ProjectModel | null> {
    return this.projectModel.findOne({
      teamId,
      launchPath
    })
  }

  public async create(project: ProjectModel | any): Promise<string> {
    const result = await this.projectModel.create(project)
    return result.id
  }

  public async update(id: string, updates: Record<string, any>): Promise<boolean> {
    const result = await this.projectModel.updateOne(
      {
        _id: id
      },
      updates
    )
    return result.acknowledged
  }

  async buildUniqueLaunchPath(teamId: string, value?: string, excludeProjectId?: string): Promise<string> {
    const normalizedPath = normalizeProjectLaunchPath(value)
    let basePath = normalizedPath || DEFAULT_PROJECT_LAUNCH_PATH

    if (RESERVED_PROJECT_LAUNCH_PATHS.has(basePath)) {
      basePath = `${DEFAULT_PROJECT_LAUNCH_PATH}-${basePath}`
    }

    let candidate = basePath
    let counter = 2

    while (await this.hasLaunchPathConflict(teamId, candidate, excludeProjectId)) {
      candidate = `${basePath}-${counter++}`
    }

    return candidate
  }

  async updateLaunchPath(project: Pick<ProjectModel, 'id' | 'teamId'>, value?: string) {
    const normalizedPath = normalizeProjectLaunchPath(value)

    if (!normalizedPath) {
      const result = await this.projectModel.updateOne(
        {
          _id: project.id
        },
        {
          $unset: {
            launchPath: 1
          }
        }
      )

      return result.acknowledged
    }

    if (RESERVED_PROJECT_LAUNCH_PATHS.has(normalizedPath)) {
      throw new BadRequestException('This launch path is reserved. Please choose another one.')
    }

    if (await this.hasLaunchPathConflict(project.teamId, normalizedPath, project.id)) {
      throw new BadRequestException('This launch path is already in use in the workspace.')
    }

    const result = await this.projectModel.updateOne(
      {
        _id: project.id
      },
      {
        $set: {
          launchPath: normalizedPath
        }
      }
    )

    return result.acknowledged
  }

  async resolvePublicRouteByDomain(hostname: string, slug?: string) {
    const normalizedHostname = normalizeDomainHostname(hostname)
    const normalizedPath = normalizeProjectLaunchPath(slug)

    if (!helper.isValid(normalizedHostname) || !helper.isValid(normalizedPath)) {
      return null
    }

    const team = await this.teamService.findByCustomDomain(normalizedHostname!)

    if (!team) {
      return null
    }

    const project = await this.findByLaunchPath(team.id, normalizedPath!)

    if (project) {
      if (project.launchMode === 'experiment' && helper.isValid(project.launchExperimentId)) {
        return {
          kind: 'experiment',
          experimentId: project.launchExperimentId,
          projectId: project.id
        }
      }

      if (project.launchMode === 'form' && helper.isValid(project.launchFormId)) {
        return {
          kind: 'form',
          formId: project.launchFormId,
          projectId: project.id
        }
      }
    }

    const form = await this.formModel.findOne({
      teamId: team.id,
      slug: normalizedPath,
      status: FormStatusEnum.NORMAL
    })

    if (!form) {
      return null
    }

    return {
      kind: 'form',
      formId: form.id,
      projectId: form.projectId
    }
  }

  private async hasLaunchPathConflict(teamId: string, launchPath: string, excludeProjectId?: string) {
    const [projectConflict, formConflict] = await Promise.all([
      this.projectModel.exists({
        teamId,
        launchPath,
        ...(excludeProjectId
          ? {
              _id: {
                $ne: excludeProjectId
              }
            }
          : {})
      }),
      this.formModel.exists({
        teamId,
        slug: launchPath,
        status: FormStatusEnum.NORMAL
      })
    ])

    return Boolean(projectConflict || formConflict)
  }

  public async delete(id: string): Promise<boolean> {
    const result = await this.projectModel.deleteOne({
      _id: id
    })
    return (result.deletedCount ?? 0) > 0
  }

  public async findMemberById(
    projectId: string,
    memberId: string
  ): Promise<ProjectMemberModel | null> {
    return this.projectMemberModel.findOne({
      projectId,
      memberId
    })
  }

  public async findProjectByMemberId(memberId: string, projectId: string) {
    return this.projectMemberModel.findOne({
      memberId,
      projectId
    })
  }

  public async findProjectsByMemberId(memberId: string): Promise<string[]> {
    const members = await this.projectMemberModel.find({
      memberId
    })
    return members.map(row => row.projectId)
  }

  public async findMembers(projectId: string | string[]): Promise<ProjectMemberModel[]> {
    return this.projectMemberModel.find({
      projectId: helper.isArray(projectId) ? { $in: projectId } : projectId
    })
  }

  public async memberCount(projectId: string): Promise<number> {
    return this.projectMemberModel.countDocuments({
      projectId
    })
  }

  public async addMembers(members: any): Promise<any> {
    return this.projectMemberModel.insertMany(members, {
      ordered: false
    })
  }

  public async createMember(member: ProjectMemberModel | any): Promise<boolean> {
    const result = await this.projectMemberModel.create(member)
    return !!result.id
  }

  public async deleteMember(projectId: string, memberId: string): Promise<boolean> {
    const result = await this.projectMemberModel.deleteOne({
      projectId,
      memberId
    })
    return (result.deletedCount ?? 0) > 0
  }

  public async deleteMembers(projectId: string, memberIds: string[]): Promise<boolean> {
    const result = await this.projectMemberModel.deleteMany({
      projectId,
      memberId: {
        $in: memberIds
      }
    })
    return (result.deletedCount ?? 0) > 0
  }

  public async deleteMemberInProjects(projectIds: string[], memberId: string): Promise<boolean> {
    const result = await this.projectMemberModel.deleteMany({
      projectId: {
        $in: projectIds
      },
      memberId
    })
    return (result.deletedCount ?? 0) > 0
  }

  public async deleteAllMemberInProject(projectId: string): Promise<boolean> {
    const result = await this.projectMemberModel.deleteMany({
      projectId
    })
    return (result.deletedCount ?? 0) > 0
  }

  async createByNewTeam(teamId: string, ownerId: string, projectName: string): Promise<void> {
    const projectId = await this.create({
      teamId,
      name: projectName,
      ownerId
    })

    await this.createMember({
      projectId,
      memberId: ownerId
    })
  }
}
