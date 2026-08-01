export const RANKING_SECTION_ID = "ranking";
export const RANKING_TOP5_HREF = `/dashboard#${RANKING_SECTION_ID}`;

export function topFiveEntries<T>(ranking: T[]) {
  return ranking.slice(0, 5);
}
