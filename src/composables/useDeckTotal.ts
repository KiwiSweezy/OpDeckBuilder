import { ref, watch, computed } from 'vue'
import { useCardStore } from '../stores/cardStore'
import { getCardPriceUSD, getUsdToCadRate, formatPrice } from '../utils/pricing'

/** Sum the market price of every card in the deck.
 *  Refetches whenever the deck changes (debounced internally by the cache).
 *  Also exposes a formatted display string in the user's chosen currency. */
export function useDeckTotal() {
  const cardStore = useCardStore()

  const totalUSD = ref<number | null>(null)
  const loading = ref(false)
  const cadRate = ref(1.40)

  // Load FX rate once on first use
  getUsdToCadRate().then(r => { cadRate.value = r })

  let token = 0
  watch(() => cardStore.deck.map(c => c.id), async (ids) => {
    if (ids.length === 0) {
      totalUSD.value = 0
      return
    }
    const myToken = ++token
    loading.value = true
    try {
      const prices = await Promise.all(ids.map(id => getCardPriceUSD(id).catch(() => null)))
      if (myToken !== token) return  // stale
      const sum = prices.reduce<number>((acc, p) => acc + (p ?? 0), 0)
      totalUSD.value = sum
    } finally {
      if (myToken === token) loading.value = false
    }
  }, { immediate: true, deep: false })

  const formatted = computed(() => {
    if (totalUSD.value === null) return '—'
    return formatPrice(totalUSD.value, cardStore.currency, cadRate.value)
  })

  const cardCount = computed(() => cardStore.deck.length)

  return { totalUSD, loading, formatted, cardCount }
}
