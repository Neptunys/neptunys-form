import { apollo, downloadFile, getDecoratedURL } from '@/utils'

import {
  ADD_PROJECT_MEMBER_GQL,
  CREATE_EXPERIMENT_GQL,
  CREATE_PROJECT_GQL,
  DELETE_EXPERIMENT_GQL,
  DELETE_PROJECT_CODE_GQL,
  DELETE_PROJECT_GQL,
  DELETE_PROJECT_MEMBER_GQL,
  EMPTY_TRASH_GQL,
  EXPERIMENTS_GQL,
  LEAVE_PROJECT_GQL,
  PROJECT_LEAD_FLOW_GQL,
  PROJECT_LAUNCH_OVERVIEW_GQL,
  RENAME_PROJECT_GQL,
  TEST_PROJECT_EMAIL_GQL,
  TEST_PROJECT_GOOGLE_SHEETS_GQL,
  UPDATE_EXPERIMENT_GQL,
  UPDATE_PROJECT_GQL
} from '@/consts'

export class ProjectService {
  static async create(teamId: string, name: string, memberIds?: string[]) {
    return apollo.mutate({
      mutation: CREATE_PROJECT_GQL,
      variables: {
        input: {
          teamId,
          name,
          memberIds
        }
      }
    })
  }

  static rename(projectId: string, name?: string, memberIds?: string[]) {
    return apollo.mutate({
      mutation: RENAME_PROJECT_GQL,
      variables: {
        input: {
          projectId,
          name,
          memberIds
        }
      }
    })
  }

  static update(projectId: string, updates: AnyMap) {
    return apollo.mutate({
      mutation: UPDATE_PROJECT_GQL,
      variables: {
        input: {
          projectId,
          ...updates
        }
      }
    })
  }

  static emptyTrash(projectId: string) {
    return apollo.mutate({
      mutation: EMPTY_TRASH_GQL,
      variables: {
        input: {
          projectId
        }
      }
    })
  }

  static deleteCode(projectId: string) {
    return apollo.query({
      query: DELETE_PROJECT_CODE_GQL,
      variables: {
        input: {
          projectId
        }
      },
      fetchPolicy: 'network-only'
    })
  }

  static delete(projectId: string, code: string) {
    return apollo.mutate({
      mutation: DELETE_PROJECT_GQL,
      variables: {
        input: {
          projectId,
          code
        }
      }
    })
  }

  static addMember(projectId: string, memberId: string) {
    return apollo.mutate({
      mutation: ADD_PROJECT_MEMBER_GQL,
      variables: {
        input: {
          projectId,
          memberId
        }
      }
    })
  }

  static removeMember(projectId: string, memberId: string) {
    return apollo.mutate({
      mutation: DELETE_PROJECT_MEMBER_GQL,
      variables: {
        input: {
          projectId,
          memberId
        }
      }
    })
  }

  static leave(projectId: string) {
    return apollo.mutate({
      mutation: LEAVE_PROJECT_GQL,
      variables: {
        input: {
          projectId
        }
      }
    })
  }

  static experiments(projectId: string) {
    return apollo.query({
      query: EXPERIMENTS_GQL,
      variables: {
        input: {
          projectId
        }
      },
      fetchPolicy: 'network-only'
    })
  }

  static launchOverview(projectId: string) {
    return apollo.query({
      query: PROJECT_LAUNCH_OVERVIEW_GQL,
      variables: {
        input: {
          projectId
        }
      },
      fetchPolicy: 'network-only'
    })
  }

  static leadFlow(projectId: string) {
    return apollo.query({
      query: PROJECT_LEAD_FLOW_GQL,
      variables: {
        input: {
          projectId
        }
      },
      fetchPolicy: 'network-only'
    })
  }

  static testGoogleSheets(projectId: string, googleSheetsLeadConfig: AnyMap) {
    return apollo.mutate({
      mutation: TEST_PROJECT_GOOGLE_SHEETS_GQL,
      variables: {
        input: {
          projectId,
          googleSheetsLeadConfig
        }
      }
    })
  }

  static testEmail(
    projectId: string,
    input: {
      emailType: 'confirmation' | 'negative_confirmation' | 'recap'
      recipientEmail: string
      settingsOverride?: AnyMap
    }
  ) {
    return apollo.mutate({
      mutation: TEST_PROJECT_EMAIL_GQL,
      variables: {
        input: {
          projectId,
          ...input
        }
      }
    })
  }

  static downloadReport(
    projectId: string,
    input: {
      startDate: string
      endDate: string
      format?: 'xlsx'
    }
  ) {
    const format = input.format || 'xlsx'

    return downloadFile(
      getDecoratedURL('/api/export/project-report', {
        projectId,
        startDate: input.startDate,
        endDate: input.endDate,
        format
      }),
      `project-report-${input.startDate}-to-${input.endDate}.${format}`
    )
  }

  static createExperiment(input: {
    projectId: string
    name: string
    variants: Array<{ formId: string; weight?: number }>
    autoPromote?: boolean
    durationHours?: number
    minimumSampleSize?: number
  }) {
    return apollo.mutate({
      mutation: CREATE_EXPERIMENT_GQL,
      variables: {
        input
      }
    })
  }

  static deleteExperiment(projectId: string, experimentId: string) {
    return apollo.mutate({
      mutation: DELETE_EXPERIMENT_GQL,
      variables: {
        input: {
          projectId,
          experimentId
        }
      }
    })
  }

  static updateExperiment(input: {
    projectId: string
    experimentId: string
    name?: string
    variants?: Array<{ formId: string; weight?: number }>
    status?: string
    winnerFormId?: string
    autoPromote?: boolean
    durationHours?: number
    minimumSampleSize?: number
  }) {
    return apollo.mutate({
      mutation: UPDATE_EXPERIMENT_GQL,
      variables: {
        input
      }
    })
  }
}
