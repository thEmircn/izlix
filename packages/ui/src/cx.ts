/** class birlestirici: falsy degerleri atar */
export const cx = (...a: (string | false | null | undefined)[]): string => a.filter(Boolean).join(' ')
