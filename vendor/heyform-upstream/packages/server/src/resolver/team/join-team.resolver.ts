import { BadRequestException, NotFoundException } from '@nestjs/common'

import { Auth, User } from '@decorator'
import { JoinTeamInput } from '@graphql'
import { timestamp } from '@heyform-inc/utils'
import { TeamRoleEnum, UserModel } from '@model'
import { Args, Mutation, Resolver } from '@nestjs/graphql'
import { MailService, TeamService, UserService } from '@service'

@Resolver()
@Auth()
export class JoinTeamResolver {
  constructor(
    private readonly teamService: TeamService,
    private readonly userService: UserService,
    private readonly mailService: MailService
  ) {}

  @Mutation(returns => Boolean)
  async joinTeam(@User() user: UserModel, @Args('input') input: JoinTeamInput): Promise<boolean> {
    const team = await this.teamService.findById(input.teamId)

    if (!team) {
      throw new NotFoundException('The workspace does not exist')
    }

    if (team.inviteCode !== input.inviteCode) {
      throw new BadRequestException('The invitation code of the workspace does not match')
    }

    if (!user.email) {
      throw new BadRequestException('This workspace invitation requires an email-based account')
    }

    const invitation = await this.teamService.findInvitation(input.teamId, user.email)

    if (!invitation) {
      throw new BadRequestException('This workspace invitation is not valid for your account')
    }

    if (invitation.expireAt <= timestamp()) {
      await this.teamService.deleteInvitation(invitation.id)
      throw new BadRequestException('This workspace invitation has expired')
    }

    const teamMember = await this.teamService.findMemberById(input.teamId, user.id)

    if (teamMember) {
      throw new BadRequestException("You've already joined the workspace")
    }

    await this.teamService.createMember({
      teamId: input.teamId,
      memberId: user.id,
      role: TeamRoleEnum.COLLABORATOR
    })

    await this.teamService.deleteInvitation(invitation.id)

    const teamOwner = await this.userService.findById(team.ownerId)

    await this.mailService.joinWorkspaceAlert(teamOwner.email, {
      teamName: team.name,
      userName: `${user.name} (${user.email})`
    })

    return true
  }
}
