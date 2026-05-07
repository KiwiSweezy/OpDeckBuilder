/**
 * Pricing utilities — TCGplayer search URLs and (future) market price helpers.
 */

/** TCGplayer search URL for a specific OPTCG card ID.
 *  Strips alt-art suffixes (_p1, _p2) since TCGplayer indexes by base ID. */
export function tcgplayerUrl(cardId: string): string {
  const baseId = cardId.replace(/_p\d+$/, '').replace(/_r\d+$/, '')
  return `https://www.tcgplayer.com/search/one-piece-card-game/product?productLineName=one-piece-card-game&q=${encodeURIComponent(baseId)}&view=grid`
}
