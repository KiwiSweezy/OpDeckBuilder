import { defineStore } from 'pinia'
import type { Card } from '../types/Card'
import allCardsData from '../data/cards.json'

/** Strip alt-art suffixes like _p1, _p2 etc. so variants count as the same card */
function baseId(id: string): string {
  return id.replace(/_p\d+$/, '')
}

export const useCardStore = defineStore('cards', {
  state: () => ({
    allCards: allCardsData as Card[],
    searchQuery: '',
    selectedColors: [] as string[],     // max 2 (OPTCG rule: decks are 1-2 colors)
    selectedTypes: [] as string[],      // 'leader', 'character', 'event'
    selectedRarities: [] as string[],   // 'sr', 'l', 'r', 'uc', 'c'
    costSortDirection: '' as '' | 'asc' | 'desc',  // '' = no sort, 'asc' = low→high, 'desc' = high→low
    selectedCard: null as Card | null,  // card shown in preview panel
    deck: [] as Card[],                 // cards in the user's deck (duplicates = multiple copies)
  }),

  getters: {
    /**
     * Applies all active filters to the card pool.
     * Filters stack: color → type → rarity → search/counter → sort.
     */
    filteredCards(state): Card[] {
      let cards = state.allCards

      // Color filter: every color on a card must be within the selected colors.
      // e.g. selecting red+blue shows red, blue, and red/blue cards — but NOT red/purple.
      if (state.selectedColors.length > 0) {
        cards = cards.filter(card => {
          const cardColors = card.color.split('/')
          return cardColors.every(c => state.selectedColors.includes(c))
        })
      }

      // Type filter
      if (state.selectedTypes.length > 0) {
        cards = cards.filter(card => state.selectedTypes.includes(card.type))
      }

      // Rarity filter
      if (state.selectedRarities.length > 0) {
        cards = cards.filter(card => state.selectedRarities.includes(card.rarity))
      }

      // Search: supports name/ID/family text search, or "c2000" syntax for counter value
      if (state.searchQuery.trim() !== '') {
        const query = state.searchQuery.toLowerCase()
        const counterMatch = query.match(/^c(\d+)$/)

        if (counterMatch && counterMatch[1]) {
          const counterVal = parseInt(counterMatch[1])
          cards = cards.filter(card => card.counter === counterVal)
        } else {
          cards = cards.filter(card =>
            card.name.toLowerCase().includes(query) ||
            card.id.toLowerCase().includes(query) ||
            card.family.toLowerCase().includes(query)
          )
        }
      }

      // Optional sort by cost
      if (state.costSortDirection === 'asc') {
        cards = [...cards].sort((a, b) => a.cost - b.cost)
      } else if (state.costSortDirection === 'desc') {
        cards = [...cards].sort((a, b) => b.cost - a.cost)
      }

      return cards
    },

    /** Total cards currently in the deck */
    deckSize(state): number {
      return state.deck.length
    },

    /** Returns a function to count copies of a specific card (exact ID) in the deck */
    deckCardCount: (state) => {
      return (cardId: string): number => {
        return state.deck.filter(c => c.id === cardId).length
      }
    },

    /** True when any filter is active — card pool stays hidden until this is true */
    hasActiveFilters(state): boolean {
      return (
        state.selectedColors.length > 0 ||
        state.selectedTypes.length > 0 ||
        state.selectedRarities.length > 0 ||
        state.searchQuery.trim() !== ''
      )
    },

    /** The leader's colors (split from "red/blue" format), or empty if no leader */
    leaderColors(state): string[] {
      const leader = state.deck.find(c => c.type === 'leader')
      if (!leader) return []
      return leader.color.split('/')
    },

    /** Total number of cards in the database */
    totalCards: (state): number => state.allCards.length,
  },

  actions: {
    /** Toggle a color filter on/off. Max 2 colors allowed (OPTCG deck rule). */
    toggleColor(color: string) {
      const index = this.selectedColors.indexOf(color)
      if (index === -1) {
        if (this.selectedColors.length < 2) {
          this.selectedColors.push(color)
        }
      } else {
        this.selectedColors.splice(index, 1)
      }
    },

    /** Toggle a type filter on/off */
    toggleType(type: string) {
      const index = this.selectedTypes.indexOf(type)
      if (index === -1) {
        this.selectedTypes.push(type)
      } else {
        this.selectedTypes.splice(index, 1)
      }
    },

    /** Toggle a rarity filter on/off */
    toggleRarity(rarity: string) {
      const index = this.selectedRarities.indexOf(rarity)
      if (index === -1) {
        this.selectedRarities.push(rarity)
      } else {
        this.selectedRarities.splice(index, 1)
      }
    },

    /** Set the card shown in the preview panel */
    selectCard(card: Card) {
      this.selectedCard = card
    },

    /**
     * Add a card to the deck, enforcing OPTCG rules:
     * - Only 1 leader allowed
     * - Non-leaders must share at least one color with the leader
     * - Max 4 copies of any non-leader card
     * - Max 51 total cards (1 leader + 50 cards)
     */
    addToDeck(card: Card) {
      // Count by base ID so alt arts (e.g. st14-003_p1) share the 4-copy limit with the original
      const base = baseId(card.id)
      const count = this.deck.filter(c => baseId(c.id) === base).length

      if (card.type === 'leader') {
        if (this.deck.some(c => c.type === 'leader')) return
      }

      if (card.type !== 'leader' && this.leaderColors.length > 0) {
        const cardColors = card.color.split('/')
        if (!cardColors.some(c => this.leaderColors.includes(c))) return
      }

      if (card.type !== 'leader' && count >= 4) return
      if (this.deck.length >= 51) return

      this.deck.push(card)
    },

    /** Remove one copy of a card (the last one added) */
    removeFromDeck(cardId: string) {
      const index = this.deck.findLastIndex(c => c.id === cardId)
      if (index !== -1) {
        this.deck.splice(index, 1)
      }
    },

    /** Remove ALL copies of a specific card (shift+right-click) */
    removeAllFromDeck(cardId: string) {
      this.deck = this.deck.filter(c => c.id !== cardId)
    },

    /** Clear the entire deck */
    clearDeck() {
      this.deck = []
    },

    /**
     * Export the deck to sim format: "4xOP15-108\n2xST29-009\n..."
     * Groups by card ID and prefixes with count.
     */
    exportDeck(): string {
      // Group by base ID so alt arts merge into one line (sim doesn't handle _p1 suffixes)
      const counts = new Map<string, number>()
      for (const card of this.deck) {
        const base = baseId(card.id)
        counts.set(base, (counts.get(base) ?? 0) + 1)
      }
      return Array.from(counts.entries())
        .map(([id, count]) => `${count}x${id}`)
        .join('\n')
    },

    /**
     * Import a deck from sim format text.
     * Parses lines like "4xOP15-108" or "1xST29-009".
     * Clears the current deck and rebuilds it, skipping unknown IDs.
     */
    importDeck(text: string) {
      const lines = text.trim().split('\n')
      const newDeck: Card[] = []

      for (const line of lines) {
        const match = line.trim().match(/^(\d+)x(.+)$/i)
        if (!match || !match[1] || !match[2]) continue

        const count = parseInt(match[1])
        const cardId = match[2].trim()
        const card = this.allCards.find(c => c.id === cardId)
        if (!card) continue

        for (let i = 0; i < count; i++) {
          newDeck.push(card)
        }
      }

      this.deck = newDeck
    },
  },
})
