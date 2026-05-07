import { ref, watch, type Ref } from 'vue'
import { getCardPriceUSD, getCardPriceUSDCached } from '../utils/pricing'

/** Reactively fetch the USD market price for a card.
 *  Fast path: if the price is already cached in localStorage, set it
 *  synchronously (no null flash, no microtask, no extra re-render).
 *  Slow path: fetch async and update when the network resolves. */
export function useCardPrice(cardId: Ref<string | null | undefined>) {
  const price = ref<number | null>(null)
  const loading = ref(false)

  watch(cardId, async (id) => {
    if (!id) {
      price.value = null
      return
    }
    // Sync fast path: skip the loading state entirely for cached cards
    const cached = getCardPriceUSDCached(id)
    if (cached !== undefined) {
      price.value = cached
      return
    }
    // Cache miss — fetch
    price.value = null
    loading.value = true
    try {
      // Capture id at fetch time so we ignore stale results when user
      // hovers a different card before this one resolves
      const fetchedId = id
      const result = await getCardPriceUSD(fetchedId)
      if (cardId.value === fetchedId) price.value = result
    } finally {
      loading.value = false
    }
  }, { immediate: true })

  return { price, loading }
}
