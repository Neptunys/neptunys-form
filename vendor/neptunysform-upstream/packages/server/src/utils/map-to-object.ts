import { helper } from '@neptunysform-inc/utils'

export function mapToObject<T = any>(mapLike: any): T {
  if (helper.isEmpty(mapLike)) {
    return {} as T
  }

  // @ts-ignore
  return helper.isMap(mapLike) ? Object.fromEntries(mapLike) : mapLike
}
