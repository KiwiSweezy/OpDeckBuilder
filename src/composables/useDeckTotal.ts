import { ref, watch, computed } from 'vue'
import { useCardStore } from '../stores/cardStore'
import { getCardPriceUSD, getUsdToCadRate, getUsdToGbpRate, formatPrice } from '../utils/pricing'

/** Sum the market price of every card in the deck.
 *
 *  Prices the DISPLAYED deck, so the total tracks the Bling toggle — swapping to
 *  alt arts is worth a median 65x per card, so the price moving is the point.
 *
 *  Reports `unpriced` alongside the total because the price API doesn't know
 *  every printing: it 404s for OP17 and ST30-ST36 entirely, and has no price for
 *  a good share of alt arts. A missing price contributes 0, so without surfacing
 *  the count a blinged deck could appear CHEAPER than the base one. */
export function useDeckTotal() {
  const cardStore = useCardStore()

  const totalUSD = ref<number | null>(null)
  const unpriced = ref(0)
  const loading = ref(false)
  const rates = ref({ CAD: 1.38, GBP: 0.79 })

  // Load FX rates once on first use
  getUsdToCadRate().then(r => { rates.value = { ...rates.value, CAD: r } })
  getUsdToGbpRate().then(r => { rates.value = { ...rates.value, GBP: r } })

  let token = 0
  watch(
    () => cardStore.displayDeck.map(c => c.id),
    async (ids) => {
      if (ids.length === 0) {
        totalUSD.value = 0
        unpriced.value = 0
        return
      }
      const myToken = ++token
      loading.value = true
      try {
        const prices = await Promise.all(ids.map(id => getCardPriceUSD(id).catch(() => null)))
        if (myToken !== token) return  // stale
        let sum = 0
        let missing = 0
        for (const p of prices) {
          if (p === null || p === undefined) missing++
          else sum += p
        }
        totalUSD.value = sum
        unpriced.value = missing
      } finally {
        if (myToken === token) loading.value = false
      }
    },
    { immediate: true, deep: false }
  )

  const formatted = computed(() => {
    if (totalUSD.value === null) return '—'
    return formatPrice(totalUSD.value, cardStore.currency, rates.value)
  })

  /** e.g. "3 of 51 cards have no market price" — null when everything is priced. */
  const unpricedNote = computed(() => {
    if (!unpriced.value) return null
    return `${unpriced.value} of ${cardStore.displayDeck.length} cards have no market price`
  })

  const cardCount = computed(() => cardStore.deck.length)

  return { totalUSD, loading, formatted, cardCount, unpriced, unpricedNote }
}
