const MIN_LEAD_SCORE = 0
const MAX_LEAD_SCORE = 3

export const LEAD_SCORE_OPTIONS = Array.from({ length: MAX_LEAD_SCORE - MIN_LEAD_SCORE + 1 }).map(
  (_, index) => {
    const value = index + MIN_LEAD_SCORE

    return {
      label: `${value} ${value === MIN_LEAD_SCORE ? 'Bad lead' : value === MAX_LEAD_SCORE ? 'Very good' : ''}`.trim(),
      value
    }
  }
)

export const LEAD_SCORE_LABEL_CLASSNAME =
  'min-w-10 text-[11px] font-medium uppercase tracking-[0.08em] text-[color:var(--heyform-answer-color)] opacity-50'

export const LEAD_SCORE_SELECT_CLASSNAME =
  'w-32 border-[color:var(--heyform-answer-color)] text-[color:var(--heyform-answer-color)] opacity-50 [&_[data-slot=icon]_svg]:text-[color:var(--heyform-answer-color)] [&_[data-slot=placeholder]]:text-[color:var(--heyform-answer-color)] [&_[data-slot=value]]:text-[color:var(--heyform-answer-color)]'

export function normalizeLeadScore(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined
  }

  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return undefined
  }

  return Math.max(MIN_LEAD_SCORE, Math.min(MAX_LEAD_SCORE, Math.round(numericValue)))
}