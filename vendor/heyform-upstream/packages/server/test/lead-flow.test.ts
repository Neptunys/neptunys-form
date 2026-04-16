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

async function run() {
  testNegativeLeadDetection()
  testStandardLeadDetection()
}

if (require.main === module) {
  run().catch(error => {
    // eslint-disable-next-line no-console
    console.error(error)
    process.exitCode = 1
  })
}