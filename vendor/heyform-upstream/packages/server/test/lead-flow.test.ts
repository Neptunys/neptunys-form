import * as assert from 'assert'

import { FieldKindEnum } from '@heyform-inc/shared-types-enums'

import {
  buildLeadAnswerSheetRows,
  buildLeadCapturePayload,
  buildLeadSheetRow,
  buildTestLeadCapturePayloads,
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

function createFormWithSkippedQuestion() {
  return {
    id: 'form_3',
    projectId: 'project_1',
    name: 'Skipped question flow',
    settings: {
      leadMediumThreshold: 50,
      leadHighThreshold: 80
    },
    fields: [
      {
        id: 'served',
        title: 'Which branch did you serve in?',
        kind: FieldKindEnum.SHORT_TEXT,
        properties: {}
      },
      {
        id: 'year',
        title: 'What year did you leave?',
        kind: FieldKindEnum.SHORT_TEXT,
        properties: {}
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

function createAnswerOnlyScoreSubmissionWithoutSnapshotScores(choiceId: string) {
  return {
    id: `submission_answer_only_stripped_${choiceId}`,
    answers: [
      {
        id: 'fit_check',
        title: 'Fit check',
        kind: FieldKindEnum.MULTIPLE_CHOICE,
        properties: {},
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

function createNegativeSubmissionWithoutSnapshotScores(choiceId: string) {
  return {
    id: `submission_negative_stripped_${choiceId}`,
    answers: [
      {
        id: 'screening',
        title: 'Eligibility screening',
        kind: FieldKindEnum.MULTIPLE_CHOICE,
        properties: {},
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

function createSubmissionWithSkippedQuestion() {
  return {
    id: 'submission_skipped_question',
    answers: [
      {
        id: 'served',
        title: 'Which branch did you serve in?',
        kind: FieldKindEnum.SHORT_TEXT,
        properties: {},
        value: 'Army'
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

function testLeadScoreFallsBackToFormChoiceScoresWhenSnapshotScoresAreMissing() {
  const payload = buildLeadCapturePayload(
    createAnswerOnlyScoreForm(),
    createAnswerOnlyScoreSubmissionWithoutSnapshotScores('best_fit')
  )
  const row = buildLeadSheetRow(payload)

  assert.strictEqual(payload.leadScore, 3)
  assert.strictEqual(payload.leadLevel, 'high')
  assert.strictEqual(payload.leadScoreVariableName, 'Answer scores')
  assert.strictEqual(row['Lead Score'], 3)
  assert.strictEqual(row['Lead Level'], 'high')
}

function testLeadSheetRowUsesCompactLayout() {
  const payload = buildLeadCapturePayload(createForm(), createSubmission('pass', 100))
  const row = buildLeadSheetRow(payload)

  assert.deepStrictEqual(Object.keys(row), [
    'Lead Contacted',
    'Lead Contacted At',
    'Traffic Source',
    'Respondent Name',
    'Respondent Email',
    'Respondent Phone',
    'Project Name',
    'Quiz Name',
    'Submitted At',
    'Lead Score',
    'Lead Level',
    'Lead ID',
    'View Answers'
  ])
  assert.strictEqual(row['Lead ID'], payload.submissionId)
  assert.strictEqual(row['Quiz Name'], payload.formName)
  assert.strictEqual(row['View Answers'], '')
}

function testLeadAnswerSheetRowsStayNormalized() {
  const payload = buildLeadCapturePayload(
    createAnswerOnlyScoreForm(),
    createAnswerOnlyScoreSubmission('best_fit')
  )
  const rows = buildLeadAnswerSheetRows(payload)

  assert.strictEqual(rows.length, 2)
  assert.deepStrictEqual(rows[0], {
    'Lead ID': payload.submissionId,
    'Quiz Name': payload.formName,
    'Submitted At': '2024-04-16 10:40:00 UTC',
    'Question Order': 1,
    Question: 'Fit check',
    Answer: 'Best fit'
  })
  assert.deepStrictEqual(rows[1], {
    'Lead ID': payload.submissionId,
    'Quiz Name': payload.formName,
    'Submitted At': '2024-04-16 10:40:00 UTC',
    'Question Order': 2,
    Question: 'Email',
    Answer: 'lead@example.com'
  })
}

function testLeadAnswerSheetRowsIncludeAllQuizQuestionsInOrder() {
  const payload = buildLeadCapturePayload(
    createFormWithSkippedQuestion(),
    createSubmissionWithSkippedQuestion()
  )
  const rows = buildLeadAnswerSheetRows(payload)

  assert.strictEqual(rows.length, 3)
  assert.deepStrictEqual(rows.map(row => [row['Question Order'], row.Question, row.Answer]), [
    [1, 'Which branch did you serve in?', 'Army'],
    [2, 'What year did you leave?', ''],
    [3, 'Email', 'lead@example.com']
  ])
}

function testBuildTestLeadCapturePayloadsScaleToUniqueLeadIds() {
  const payloads = buildTestLeadCapturePayloads(createAnswerOnlyScoreForm(), undefined, 10)
  const submissionIds = payloads.map(payload => payload.submissionId)
  const respondentEmails = payloads.map(payload => payload.respondentEmail)

  assert.strictEqual(payloads.length, 10)
  assert.strictEqual(new Set(submissionIds).size, 10)
  assert.strictEqual(new Set(respondentEmails).size, 10)
}

function testNegativeLeadDetectionFallsBackToFormChoiceScoresWhenSnapshotScoresAreMissing() {
  const payload = buildLeadCapturePayload(
    createForm(),
    createNegativeSubmissionWithoutSnapshotScores('fail')
  )
  const values = buildLeadTemplateValues(payload)
  const row = buildLeadSheetRow(payload)

  assert.strictEqual(payload.leadScore, 0)
  assert.strictEqual(payload.leadLevel, 'low')
  assert.strictEqual(payload.hasZeroScoreAnswer, true)
  assert.strictEqual(values.leadResult, 'negative')
  assert.strictEqual(row['Lead Score'], 0)
  assert.strictEqual(row['Lead Level'], 'low')
}

async function run() {
  testNegativeLeadDetection()
  testStandardLeadDetection()
  testLeadScoreFallsBackToAnswerScores()
  testLeadScoreFallsBackToFormChoiceScoresWhenSnapshotScoresAreMissing()
  testLeadSheetRowUsesCompactLayout()
  testLeadAnswerSheetRowsStayNormalized()
  testLeadAnswerSheetRowsIncludeAllQuizQuestionsInOrder()
  testBuildTestLeadCapturePayloadsScaleToUniqueLeadIds()
  testNegativeLeadDetectionFallsBackToFormChoiceScoresWhenSnapshotScoresAreMissing()
}

if (require.main === module) {
  run().catch(error => {
    // eslint-disable-next-line no-console
    console.error(error)
    process.exitCode = 1
  })
}