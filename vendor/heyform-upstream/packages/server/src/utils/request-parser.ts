import { helper } from '@heyform-inc/utils'

export function requestParser(req: any, keys: string[]): any {
  const sources = ['body', 'query', 'params']
  let value: any

  for (const source of sources) {
    const container = req?.[source]

    if (helper.isEmpty(container)) {
      continue
    }

    for (const key of keys) {
      const searchValue = container[key]

      if (helper.isValid(searchValue)) {
        value = searchValue
        break
      }
    }
  }

  return value
}
