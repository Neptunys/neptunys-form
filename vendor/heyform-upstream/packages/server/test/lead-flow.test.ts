import * as assert from 'assert'

import { FieldKindEnum } from '@heyform-inc/shared-types-enums'

import {
  buildLeadCapturePayload,
  buildLeadTemplateValues,
  resolveRespondentNotificationTemplates
} from '../src/utils/lead-flow'

const choiceProperties = {
  choices: [
    {
      id: 'pass',
      label: 'Pass',
      score: 1
    },
    {
      id: 'fail',
      label: 'Fail',
      score: 0
    }
  ]
}

function createForm() {
  return {
    id: 'form_1',
    projectId: 'project_1',
    name: 'Eligibility check',
    settings: {
      leadMediumThreshold: 50,
      leadHighThreshold: 80
    },
    fields: [
      {
        id: 'screening',
        title: 'Eligibility screening',
        kind: FieldKindEnum.MULTIPLE_CHOICE,
        properties: choiceProperties
      },
      {
        id: 'email',
        title: 'Email',
        kind: FieldKindEnum.EMAIL,
        properties: {}
      }
    ],
    variables: [
      {
        id: 'lead_score',
        name: 'Lead Score',
        kind: 'number' as const,
        value: 0,
        logics: []
      }
    ]
  }
}

function createAnswerOnlyScoreForm() {
  return {
    id: 'form_2',
    projectId: 'project_1',
    name: 'Builder scoring only',
    settings: {
      enableLeadScoring: true,
      leadMediumThreshold: 2,
      leadHighThreshold: 3
    },
    fields: [
      {
        id: 'fit_check',
        title: 'Fit check',
        kind: FieldKindEnum.MULTIPLE_CHOICE,
        properties: {
          choices: [
            {
              id: 'best_fit',
              label: 'Best fit',
              score: 3
            },
            {
              id: 'maybe_fit',
              label: 'Maybe fit',
              score: 1
            }
          ]
        }
      },
      {
        id: 'email',
        title: 'Email',
        kind: FieldKindEnum.EMAIL,
        properties: {}
      }
    ],
    variables: []
  }
}

function createSubmission(choiceId: string, leadScore: number) {
  return {
    id: `submission_${choiceId}`,
    answers: [
      {
        id: 'screening',
        title: 'Eligibility screening',
        kind: FieldKindEnum.MULTIPLE_CHOICE,
        properties: choiceProperties,
        value: {
          value: [choiceId],
          other: ''
        }
      },
      {
        id: 'email',
        title: 'Email',
        kind: FieldKindEnum.EMAIL,
        properties: {},
        value: 'lead@example.com'
      }
    ],
    variables: [
      {
        id: 'lead_score',
        name: 'Lead Score',
        kind: 'number' as const,
        value: leadScore,
        logics: []
      }
    ],
    endAt: 1713264000
  }
}

function createAnswerOnlyScoreSubmission(choiceId: string) {
  return {
    id: `submission_answer_only_${choiceId}`,
    answers: [
      {
        id: 'fit_check',
        title: 'Fit check',
        kind: FieldKindEnum.MULTIPLE_CHOICE,
        properties: {
          choices: [
            {
              id: 'best_fit',
              label: 'Best fit',
              score: 3
            },
            {
              id: 'maybe_fit',
              label: 'Maybe fit',
              score: 1
            }
          ]
        },
        value: {
          value: [choiceId],
          other: ''
        }
      },
      {
        id: 'email',
        title: 'Email',
        kind: FieldKindEnum.EMAIL,
        properties: {},
        value: 'lead@example.com'
      }
    ],
    variables: [],
    endAt: 1713264000
  }
}

function testNegativeLeadDetection() {
  const payload = buildLeadCapturePayload(createForm(), createSubmission('fail', 0))
  const values = buildLeadTemplateValues(payload)
  const templates = resolveRespondentNotificationTemplates(payload, {
    subject: 'Standard subject',
    message: 'Standard message'
  })

  assert.strictEqual(payload.hasZeroScoreAnswer, true)
  assert.strictEqual(values.leadResult, 'negative')
  assert.strictEqual(templates.isNegative, true)
  assert.strictEqual(templates.subjectTemplate, 'Your result for {formName}')
}

function testStandardLeadDetection() {
  const payload = buildLeadCapturePayload(createForm(), createSubmission('pass', 100))
  const values = buildLeadTemplateValues(payload)
  const templates = resolveRespondentNotificationTemplates(payload, {
    subject: 'Standard subject',
    message: 'Standard message'
  })

  assert.strictEqual(payload.hasZeroScoreAnswer, false)
  assert.strictEqual(values.leadResult, 'standard')
  assert.strictEqual(templates.isNegative, false)
  assert.strictEqual(templates.subjectTemplate, 'Standard subject')
}

function testLeadScoreFallsBackToAnswerScores() {
  const payload = buildLeadCapturePayload(
    createAnswerOnlyScoreForm(),
    createAnswerOnlyScoreSubmission('best_fit')
  )

  assert.strictEqual(payload.leadScore, 3)
  assert.strictEqual(payload.leadLevel, 'high')
  assert.strictEqual(payload.leadScoreVariableName, 'Answer scores')
}

async function run() {
  testNegativeLeadDetection()
  testStandardLeadDetection()
  testLeadScoreFallsBackToAnswerScores()
}

if (require.main === module) {
  run().catch(error => {
    // eslint-disable-next-line no-console
    console.error(error)
    process.exitCode = 1
  })
}