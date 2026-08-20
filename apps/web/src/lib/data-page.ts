export const DATA_PAGE_SIZE = 50

export interface DataPageParams {
  page: number
  from: string | null
  to: string | null
}

export function parseDataPageParams(searchParams: Record<string, string | string[] | undefined>): DataPageParams {
  const rawPage = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page
  const pageNumber = Number(rawPage)
  const page = Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1
  const rawFrom = Array.isArray(searchParams.from) ? searchParams.from[0] : searchParams.from
  const rawTo = Array.isArray(searchParams.to) ? searchParams.to[0] : searchParams.to
  const date = (value: string | undefined): string | null => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
  return { page, from: date(rawFrom), to: date(rawTo) }
}

export function pageOffset(page: number): number { return (page - 1) * DATA_PAGE_SIZE }
