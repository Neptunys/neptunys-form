import type { QuizVariant, ResultKey, SessionAnswers, VariantKey } from './types'

function hasPositiveMulti(answer: SessionAnswers[string] | undefined) {
  return Array.isArray(answer) && answer.some((value) => value !== 'none')
}

function evaluateConfiguredResult(variant: QuizVariant, answers: SessionAnswers): ResultKey {
  let score = 0

  for (const question of variant.questions) {
    const currentAnswer = answers[question.id]
    const selectedIds = Array.isArray(currentAnswer) ? currentAnswer : typeof currentAnswer === 'string' ? [currentAnswer] : []
    for (const optionId of selectedIds) {
      const option = question.options.find((entry) => entry.id === optionId)
      const effect = option?.result ?? 'neutral'
      if (effect === 'hard-fail') {
        return 'hard-fail'
      }
      if (effect === 'likely') {
        score += 2
      }
      if (effect === 'maybe') {
        score += 1
      }
      if (effect === 'soft-fail') {
        score -= 2
      }
    }
  }

  if (score >= Math.max(3, variant.questions.length)) {
    return 'likely'
  }
  if (score <= -2) {
    return 'soft-fail'
  }
  return 'maybe'
}

export function evaluateResult(variantId: VariantKey, answers: SessionAnswers, variant?: QuizVariant): ResultKey {
  if (variant && variant.questions.some((question) => question.options.some((option) => option.result && option.result !== 'neutral'))) {
    return evaluateConfiguredResult(variant, answers)
  }

  if (variantId === 'variant-a') {
    if (answers['service-check'] === 'no') {
      return 'hard-fail'
    }

    if (
      answers['served-after-date'] === 'no' ||
      answers['noise-exposure'] === 'no' ||
      answers['hearing-worsened'] === 'no'
    ) {
      return 'soft-fail'
    }

    if (
      answers['service-check'] === 'yes' &&
      answers['noise-exposure'] === 'yes' &&
      answers['hearing-worsened'] === 'yes' &&
      (answers['served-after-date'] === 'yes' || answers['served-after-date'] === 'not-sure')
    ) {
      return 'likely'
    }

    return 'maybe'
  }

  if (answers['service-branch'] === 'not-uk-service') {
    return 'hard-fail'
  }

  const servedAfterDate = answers['served-after-date']
  const exposures = answers['noise-exposure-detailed']
  const symptoms = answers['symptoms']
  const worsened = answers['hearing-worsened']
  const previousClaim = answers['previous-claim']

  const exposurePositive = hasPositiveMulti(exposures)
  const symptomPositive = hasPositiveMulti(symptoms)
  const datePositive = servedAfterDate === 'yes' || servedAfterDate === 'not-sure'
  const worseningPositive = worsened === 'yes'
  const worseningWeak = worsened === 'no'
  const confidencePenalty = previousClaim === 'yes'

  if (!datePositive || (!exposurePositive && !symptomPositive) || worseningWeak) {
    return 'soft-fail'
  }

  if (exposurePositive && symptomPositive && worseningPositive && !confidencePenalty) {
    return 'likely'
  }

  return 'maybe'
}

