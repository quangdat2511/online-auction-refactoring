/**
 * Calculates pagination metadata from raw query results.
 * @param {number} totalCount - Total number of records
 * @param {number} page - Current page (1-based)
 * @param {number} limit - Records per page
 * @returns {{ nPages: number, from: number, to: number }}
 */
export function calcPagination(totalCount, page, limit) {
  const nPages = Math.ceil(totalCount / limit);
  let from = (page - 1) * limit + 1;
  let to = page * limit;
  if (to > totalCount) to = totalCount;
  if (totalCount === 0) { from = 0; to = 0; }
  return { nPages, from, to };
}
