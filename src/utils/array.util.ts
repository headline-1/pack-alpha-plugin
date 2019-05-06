export const arraify = <T>(t: T[] | T | undefined | null, separator?: string): T[] => t === null || t === undefined
  ? []
  : Array.isArray(t)
    ? t
    : (separator && typeof t === 'string')
      ? t.split(separator) as any as T[]
      : [t];
