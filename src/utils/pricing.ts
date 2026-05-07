/**
 * Pricing utilities — TCGplayer search URLs + market price fetching via the
 * free, key-less OPTCG API (https://www.optcgapi.com).
 *
 * The API returns all variants (base + alt arts) for a given card ID in one
 * response, so we cache the full variant list per base ID and look up the
 * specific variant we need. Prices update daily, so cache for 24 hours.
 */

const PRICE_CACHE_KEY = 'optcg-prices-v1'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000  // 24 hours

interface VariantPrice {
  imageId: string       // e.g. "OP15-001" or "OP15-001_p1"
  marketPrice: number   // USD market price from TCGplayer
}

interface CachedEntry {
  fetchedAt: number
  variants: VariantPrice[] | null   // null = card not found / no prices
}

type PriceCache = Record<string, CachedEntry>

/** TCGplayer search URL for a specific OPTCG card ID. */
export function tcgplayerUrl(cardId: string): string {
  const baseId = cardId.replace(/_p\d+$/, '').replace(/_r\d+$/, '')
  return `https://www.tcgplayer.com/search/one-piece-card-game/product?productLineName=one-piece-card-game&q=${encodeURIComponent(baseId)}&view=grid`
}

/** Strip alt-art / reprint suffixes to get the base card ID. */
function baseId(cardId: string): string {
  return cardId.replace(/_p\d+$/, '').replace(/_r\d+$/, '')
}

/** In-memory cache mirror — read localStorage ONCE on first access,
 *  then keep the parsed object in memory. Subsequent lookups are O(1)
 *  hash reads instead of full JSON re-parses. */
let memCache: PriceCache | null = null

function getCache(): PriceCache {
  if (memCache !== null) return memCache
  try {
    const raw = localStorage.getItem(PRICE_CACHE_KEY)
    memCache = raw ? JSON.parse(raw) : {}
  } catch {
    memCache = {}
  }
  return memCache!
}

function persistCache() {
  if (memCache === null) return
  try {
    localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(memCache))
  } catch {
    // Quota exceeded etc. — silently ignore, prices will refetch next session
  }
}

/** Fetch a single base card's variants from the API. Returns null on error. */
async function fetchVariants(base: string): Promise<VariantPrice[] | null> {
  try {
    const resp = await fetch(`https://optcgapi.com/api/sets/card/${base}/`)
    if (!resp.ok) return null
    const data = await resp.json() as Array<{
      card_image_id?: string
      market_price?: number | null
    }>
    if (!Array.isArray(data) || data.length === 0) return null
    return data
      .filter(v => v.card_image_id && typeof v.market_price === 'number')
      .map(v => ({ imageId: v.card_image_id!, marketPrice: v.market_price! }))
  } catch {
    return null
  }
}

/** In-flight requests so multiple concurrent lookups for the same card
 *  share a single fetch. */
const inFlight = new Map<string, Promise<VariantPrice[] | null>>()

async function getVariants(base: string): Promise<VariantPrice[] | null> {
  const cache = getCache()
  const entry = cache[base]
  if (entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS) {
    return entry.variants
  }
  // Coalesce concurrent requests
  const existing = inFlight.get(base)
  if (existing) return existing

  const promise = fetchVariants(base).then(variants => {
    cache[base] = { fetchedAt: Date.now(), variants }
    persistCache()
    inFlight.delete(base)
    return variants
  })
  inFlight.set(base, promise)
  return promise
}

/** Synchronous cache lookup using the in-memory mirror.
 *  Returns number | null | undefined as before but with no localStorage parse. */
export function getCardPriceUSDCached(cardId: string): number | null | undefined {
  const base = baseId(cardId)
  const entry = getCache()[base]
  if (!entry || Date.now() - entry.fetchedAt >= CACHE_TTL_MS) return undefined
  if (!entry.variants) return null
  const exact = entry.variants.find(v => v.imageId === cardId)
  return exact?.marketPrice ?? null
}

/** Async lookup that fetches if not cached.
 *  Returns null when the API has no data for THIS specific variant — we
 *  intentionally do NOT fall back to other variants because alt-art prices
 *  can be 100x the base card price (e.g. ST26-005 base vs ST26-005_p1 manga
 *  rare). Better to show "—" than mislead with wrong data. */
export async function getCardPriceUSD(cardId: string): Promise<number | null> {
  const base = baseId(cardId)
  const variants = await getVariants(base)
  if (!variants) return null
  const exact = variants.find(v => v.imageId === cardId)
  return exact?.marketPrice ?? null
}

/* ===== Currency conversion (USD → CAD) =====
 *
 * Uses a hardcoded approximate rate to avoid CORS-blocked / unreliable
 * external FX APIs causing render-blocking failures. Update USD_TO_CAD
 * periodically as needed; for a deck-building tool, an approximate rate
 * is more than fine.
 *
 * Rate as of 2026-05: 1 USD ≈ 1.38 CAD
 */
const USD_TO_CAD_APPROX = 1.38

/** Get USD→CAD exchange rate. Synchronous + cheap — no network request. */
export async function getUsdToCadRate(): Promise<number> {
  return USD_TO_CAD_APPROX
}

export function formatPrice(usd: number, currency: 'USD' | 'CAD', cadRate: number): string {
  const value = currency === 'CAD' ? usd * cadRate : usd
  const symbol = currency === 'CAD' ? 'C$' : '$'
  return `${symbol}${value.toFixed(2)}`
}
