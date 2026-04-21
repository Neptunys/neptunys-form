import { BadRequestException } from '@nestjs/common'

import { Auth, Team, TeamGuard } from '@decorator'
import { AddCustomDomainInput } from '@graphql'
import { TeamModel } from '@model'
import { helper } from '@neptunysform-inc/utils'
import { Args, Mutation, Resolver } from '@nestjs/graphql'
import { TeamService } from '@service'

function normalizeDomain(value?: string) {
  if (!helper.isValid(value)) {
    return undefined
  }

  let normalized = value!.trim().toLowerCase()
  normalized = normalized.replace(/^https?:\/\//, '')
  normalized = normalized.replace(/\/.*$/, '')
  normalized = normalized.replace(/\.+$/, '')

  return normalized || undefined
}

function isValidCustomDomain(value: string) {
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value)
}

@Resolver()
@Auth()
export class AddCustomDomainResolver {
  constructor(private readonly teamService: TeamService) {}

  @Mutation(returns => Boolean)
  @TeamGuard()
  async addCustomDomain(
    @Team() team: TeamModel,
    @Args('input') input: AddCustomDomainInput
  ): Promise<boolean> {
    if (!team.isOwner) {
      throw new BadRequestException("You don't have permission to change the workspace settings")
    }

    const domain = normalizeDomain(input.domain)

    if (domain && !isValidCustomDomain(domain)) {
      throw new BadRequestException('Please enter a valid domain name')
    }

    if (domain) {
      const existingTeam = await this.teamService.findByCustomDomain(domain)

      if (existingTeam && existingTeam.id !== input.teamId) {
        throw new BadRequestException('This domain is already in use by another workspace')
      }
    }

    return await this.teamService.update(input.teamId, {
      customDomain: domain
    })
  }
}