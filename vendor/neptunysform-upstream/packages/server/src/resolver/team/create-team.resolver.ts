import { BadRequestException } from '@nestjs/common'

import { Auth, User } from '@decorator'
import { CreateTeamInput } from '@graphql'
import { TeamRoleEnum, UserModel } from '@model'
import { Args, Mutation, Resolver } from '@nestjs/graphql'
import { ProjectService, TeamService } from '@service'

@Resolver()
@Auth()
export class CreateTeamResolver {
  constructor(
    private readonly teamService: TeamService,
    private readonly projectService: ProjectService
  ) {}

  @Mutation(returns => String)
  async createTeam(
    @User() user: UserModel,
    @Args('input') input: CreateTeamInput
  ): Promise<string> {
    const memberships = await this.teamService.findAll(user.id)
    const canCreateWorkspace =
      memberships.length < 1 || memberships.some(team => team.ownerId === user.id)

    if (!canCreateWorkspace) {
      throw new BadRequestException('Invited members cannot create new workspaces')
    }

    const teamId = await this.teamService.create({
      ownerId: user.id,
      name: input.name,
      avatar: input.avatar,
      storageQuota: 0
    })

    await this.teamService.createMember({
      teamId,
      memberId: user.id,
      role: TeamRoleEnum.ADMIN
    })

    await this.projectService.createByNewTeam(teamId, user.id, input.projectName)

    return teamId
  }
}
