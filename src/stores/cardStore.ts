import { defineStore } from 'pinia'
import type { Card } from '../types/Card'
import allCardsData from '../data/cards.json'

/** Strip alt-art suffixes like _p1, _p2 etc. so variants count as the same card */
function baseId(id: string): string {
  return id.replace(/_p\d+$/, '')
}

/** Sets that rotated out of Standard format on 2026-04-01 (Block 1).
 *  Cards from these sets are filtered when "Hide Rotated" is on.
 *  Reprints of these cards in newer sets keep their newer set IDs and stay legal. */
const ROTATED_SETS = new Set([
  'OP01', 'OP02', 'OP03', 'OP04',
  'ST01', 'ST02', 'ST03', 'ST04', 'ST05', 'ST06', 'ST07', 'ST08', 'ST09',
])

/** Returns the set prefix from a card ID (everything before the first dash). */
function cardSet(id: string): string {
  const dash = id.indexOf('-')
  return dash === -1 ? id : id.slice(0, dash)
}

/** Lazily-built lowercase search index for fast text matching.
 *  Maps card.id → "name id family ability" all lowercased and concatenated.
 *  Built once on first access since allCards never changes after load. */
const SEARCH_INDEX_CACHE = new Map<string, string>()
function searchIndexFor(card: Card): string {
  let cached = SEARCH_INDEX_CACHE.get(card.id)
  if (cached === undefined) {
    cached = `${card.name} ${card.id} ${card.family} ${card.ability}`.toLowerCase()
    SEARCH_INDEX_CACHE.set(card.id, cached)
  }
  return cached
}

/** Lazily-built lowercase ability cache for keyword matching */
const ABILITY_LOWER_CACHE = new Map<string, string>()
function abilityLowerFor(card: Card): string {
  let cached = ABILITY_LOWER_CACHE.get(card.id)
  if (cached === undefined) {
    cached = card.ability.toLowerCase()
    ABILITY_LOWER_CACHE.set(card.id, cached)
  }
  return cached
}

/** Cached split of card.color into its components ("red/blue" → ["red","blue"]).
 *  Color filter runs this for every card every time — caching saves a string
 *  allocation per card per filter change. */
const COLORS_SPLIT_CACHE = new Map<string, string[]>()
function colorsFor(card: Card): string[] {
  let cached = COLORS_SPLIT_CACHE.get(card.id)
  if (cached === undefined) {
    cached = card.color.split('/')
    COLORS_SPLIT_CACHE.set(card.id, cached)
  }
  return cached
}

/** Convert color string like "red/green" to abbreviation like "RG" */
const COLOR_ABBREVS: Record<string, string> = {
  red: 'R', blue: 'U', green: 'G', purple: 'P', black: 'B', yellow: 'Y',
}
function colorAbbrev(color: string): string {
  return color.split('/').map(c => COLOR_ABBREVS[c.trim()] ?? c[0]?.toUpperCase() ?? '').join('')
}

const STORAGE_KEY = 'op-saved-decks'
const LAST_DECK_KEY = 'op-last-deck'

/** Read the saved decks map from localStorage */
function readSavedDecks(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

/** Write the saved decks map to localStorage */
function writeSavedDecks(decks: Record<string, string[]>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(decks))
}

export const useCardStore = defineStore('cards', {
  state: () => ({
    allCards: allCardsData as Card[],
    searchQuery: '',
    selectedColors: [] as string[],     // max 2 (OPTCG rule: decks are 1-2 colors)
    selectedTypes: [] as string[],      // 'leader', 'character', 'event'
    selectedRarities: [] as string[],   // 'sr', 'l', 'r', 'uc', 'c'
    selectedCounters: [] as number[],    // 1000, 2000
    selectedKeywords: [] as string[],    // 'rush', 'blocker', etc.
    searchChips: [] as string[],          // committed search filters (AND-combined)
    hideRotated: false,                   // hide Block 1 cards (OP01-OP04, ST01-ST09)
    currency: 'USD' as 'USD' | 'CAD',    // display currency for prices
    costSortDirection: '' as '' | 'asc' | 'desc',  // '' = no sort, 'asc' = low→high, 'desc' = high→low
    selectedCard: null as Card | null,  // card shown in preview panel
    deck: [] as Card[],                 // cards in the user's deck (duplicates = multiple copies)
    deckName: '',                        // name for saving/loading decks
    _savedDecksVersion: 0,               // bumped on save/delete to trigger reactivity
  }),

  getters: {
    /**
     * Applies all active filters in a SINGLE pass over allCards.
     * Combining filters means one array allocation instead of 8, and we
     * short-circuit as soon as any condition fails for a card.
     */
    filteredCards(state): Card[] {
      // Snapshot all filter state once (avoids repeated proxy lookups in hot loop)
      const colors = state.selectedColors
      const types = state.selectedTypes
      const rarities = state.selectedRarities
      const counters = state.selectedCounters
      const keywords = state.selectedKeywords
      const hideRotated = state.hideRotated
      const liveQuery = state.searchQuery.trim()
      const chips = state.searchChips

      const hasColors = colors.length > 0
      const hasTypes = types.length > 0
      const hasRarities = rarities.length > 0
      const hasCounters = counters.length > 0
      const hasKeywords = keywords.length > 0
      const hasSearch = chips.length > 0 || liveQuery.length > 0
      const sortDir = state.costSortDirection

      const lowerTerms = hasSearch
        ? [...chips, ...(liveQuery ? [liveQuery] : [])].map(t => t.toLowerCase())
        : null

      const keywordPatterns: Record<string, RegExp> = hasKeywords ? {
        searcher: /look at.*from the top of your deck/i,
        removal: /k\.?o\.? (up to|all|one|1)\b|return up to \d.{0,80}of your opponent|return.{0,100}opponent.{0,100}(hand|deck)/i,
        'anti-removal': /cannot be removed from the field|would (be )?(k\.?o.?ed?|leave|removed).{0,120}instead/i,
      } : {}

      const cards = state.allCards.filter(card => {
        // Color
        if (hasColors) {
          const cardColors = colorsFor(card)
          for (const c of cardColors) if (!colors.includes(c)) return false
        }
        // Type
        if (hasTypes && !types.includes(card.type)) return false
        // Rarity
        if (hasRarities && !rarities.includes(card.rarity)) return false
        // Counter
        if (hasCounters && !counters.includes(card.counter)) return false
        // Hide rotated (Block 1)
        if (hideRotated && ROTATED_SETS.has(cardSet(card.id))) return false
        // Keywords
        if (hasKeywords) {
          const ability = abilityLowerFor(card)
          for (const kw of keywords) {
            const pattern = keywordPatterns[kw]
            if (pattern ? !pattern.test(card.ability) : !ability.includes(kw)) return false
          }
        }
        // Search chips + live query
        if (lowerTerms) {
          const haystack = searchIndexFor(card)
          for (const t of lowerTerms) if (!haystack.includes(t)) return false
        }
        return true
      })

      // Sort (only allocates when sorting is active)
      if (sortDir === 'asc') return cards.sort((a, b) => a.cost - b.cost)
      if (sortDir === 'desc') return cards.sort((a, b) => b.cost - a.cost)
      return cards
    },

    /** Total cards currently in the deck */
    deckSize(state): number {
      return state.deck.length
    },

    /** O(1) lookup map: cardId → number of copies in deck.
     *  Lets CardThumbnails check their count without filtering the whole deck. */
    deckCounts(state): Record<string, number> {
      const counts: Record<string, number> = {}
      for (const card of state.deck) {
        counts[card.id] = (counts[card.id] ?? 0) + 1
      }
      return counts
    },

    /** Deck breakdown stats for the stats panel */
    deckStats(state) {
      const nonLeader = state.deck.filter(c => c.type !== 'leader')
      const costCurve: Record<number, number> = {}
      let counter1k = 0
      let counter2k = 0
      let events = 0
      let searchers = 0
      let blockers = 0
      let rush = 0
      let banish = 0
      let doubleAttack = 0
      let onKO = 0
      const searcherPattern = /look at.*from the top of your deck/i
      for (const card of nonLeader) {
        const ability = card.ability.toLowerCase()
        costCurve[card.cost] = (costCurve[card.cost] ?? 0) + 1
        if (card.counter === 1000) counter1k++
        if (card.counter === 2000) counter2k++
        if (card.type === 'event') events++
        if (searcherPattern.test(card.ability)) searchers++
        if (ability.includes('blocker')) blockers++
        if (ability.includes('rush')) rush++
        if (ability.includes('banish')) banish++
        if (ability.includes('double attack')) doubleAttack++
        if (ability.includes('on k.o.')) onKO++
      }
      return { costCurve, counter1k, counter2k, events, searchers, blockers, rush, banish, doubleAttack, onKO }
    },

    /** True when any filter is active — card pool stays hidden until this is true */
    hasActiveFilters(state): boolean {
      return (
        state.selectedColors.length > 0 ||
        state.selectedTypes.length > 0 ||
        state.selectedRarities.length > 0 ||
        state.selectedCounters.length > 0 ||
        state.selectedKeywords.length > 0 ||
        state.searchChips.length > 0 ||
        state.searchQuery.trim() !== ''
      )
    },

    /** The leader's colors (split from "red/blue" format), or empty if no leader */
    leaderColors(state): string[] {
      const leader = state.deck.find(c => c.type === 'leader')
      if (!leader) return []
      return leader.color.split('/')
    },

    /** Saved decks with leader info for the dropdown display */
    savedDecks(state): { name: string; leaderName: string; leaderColors: string; leaderImage: string }[] {
      state._savedDecksVersion // read to create reactive dependency
      const decks = readSavedDecks()
      return Object.entries(decks).map(([name, ids]) => {
        const leaderCard = ids
          .map(id => state.allCards.find(c => c.id === id))
          .find(c => c?.type === 'leader')
        return {
          name,
          leaderName: leaderCard?.name ?? '',
          leaderColors: leaderCard ? colorAbbrev(leaderCard.color) : '',
          leaderImage: leaderCard?.images.small ?? '',
        }
      })
    },
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

    /** Toggle a counter filter on/off */
    toggleCounter(value: number) {
      const index = this.selectedCounters.indexOf(value)
      if (index === -1) {
        this.selectedCounters.push(value)
      } else {
        this.selectedCounters.splice(index, 1)
      }
    },

    /** Toggle the Block 1 / rotated cards filter on/off */
    toggleHideRotated() {
      this.hideRotated = !this.hideRotated
    },

    /** Switch display currency (USD ↔ CAD). Persists to localStorage. */
    toggleCurrency() {
      this.currency = this.currency === 'USD' ? 'CAD' : 'USD'
      try { localStorage.setItem('op-currency', this.currency) } catch {}
    },

    /** Commit the current search query as a chip and clear the input.
     *  Each chip is an AND filter on the card pool. */
    commitSearchChip() {
      const term = this.searchQuery.trim()
      if (!term) return
      // Avoid duplicates
      if (!this.searchChips.includes(term)) {
        this.searchChips.push(term)
      }
      this.searchQuery = ''
    },

    /** Remove a single chip by value */
    removeSearchChip(term: string) {
      const i = this.searchChips.indexOf(term)
      if (i !== -1) this.searchChips.splice(i, 1)
    },

    /** Clear all chips at once */
    clearSearchChips() {
      this.searchChips = []
    },

    /** Toggle a keyword filter on/off (matches against ability text) */
    toggleKeyword(keyword: string) {
      const index = this.selectedKeywords.indexOf(keyword)
      if (index === -1) {
        this.selectedKeywords.push(keyword)
      } else {
        this.selectedKeywords.splice(index, 1)
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
     * Robust to CRLF/CR/LF line endings, en-dash vs hyphen in card IDs,
     * Unicode whitespace, and minor format variations like "4 x ID" or "4*ID".
     */
    importDeck(text: string) {
      // Normalize line endings (handles \r\n, \r, \n) and split
      const lines = text.replace(/\r\n?/g, '\n').split('\n')
      const newDeck: Card[] = []

      // Build a normalized lookup so we can match even if the input has
      // weird unicode dashes or non-ASCII characters in the card ID
      const normalize = (s: string) =>
        s.toUpperCase()
          .replace(/[‐-―−]/g, '-')  // en-dash, em-dash, minus → hyphen
          .replace(/[ ​‌‍﻿]/g, '')  // strip nbsp, ZWSP, BOM
          .replace(/\s+/g, '')

      const cardsByNormId = new Map<string, Card>()
      for (const c of this.allCards) {
        cardsByNormId.set(normalize(c.id), c)
      }

      // Match: optional whitespace, count, optional whitespace, x or *,
      // optional whitespace, the rest of the line as the ID
      const lineRe = /^\s*(\d+)\s*[x*×]\s*(.+?)\s*$/i

      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line) continue
        const match = line.match(lineRe)
        if (!match || !match[1] || !match[2]) continue

        const count = parseInt(match[1], 10)
        if (!count || count > 51) continue
        const card = cardsByNormId.get(normalize(match[2]))
        if (!card) continue

        for (let i = 0; i < count; i++) {
          newDeck.push(card)
        }
      }

      this.deck = newDeck
      this.applyLeaderColors()
    },

    /** Check if a deck name already exists in saved decks */
    hasSavedDeck(name: string): boolean {
      const decks = readSavedDecks()
      return name.trim() in decks
    },

    /** Save the current deck to localStorage under deckName. Returns a status message. */
    saveDeck(): string {
      const name = this.deckName.trim()
      if (!name) return 'Enter a deck name first'
      if (this.deck.length === 0) return 'Deck is empty'

      const decks = readSavedDecks()
      decks[name] = this.deck.map(c => c.id)
      writeSavedDecks(decks)
      localStorage.setItem(LAST_DECK_KEY, name)
      this._savedDecksVersion++
      return `Saved "${name}"`
    },

    /** Load a saved deck from localStorage by name. Returns a status message. */
    loadDeck(name: string): string {
      const decks = readSavedDecks()
      const ids = decks[name]
      if (!ids) return `Deck "${name}" not found`

      const newDeck: Card[] = []
      for (const id of ids) {
        const card = this.allCards.find(c => c.id === id)
        if (card) newDeck.push(card)
      }

      this.deck = newDeck
      this.deckName = name
      localStorage.setItem(LAST_DECK_KEY, name)
      this.applyLeaderColors()
      return `Loaded "${name}" (${newDeck.length} cards)`
    },

    /** Set color filters to match the leader's colors (if a leader exists in the deck) */
    applyLeaderColors() {
      const leader = this.deck.find(c => c.type === 'leader')
      if (leader) {
        this.selectedColors = leader.color.split('/')
      }
    },

    /** Auto-load the most recently used deck on app startup */
    initStore() {
      const lastName = localStorage.getItem(LAST_DECK_KEY)
      if (lastName) {
        const decks = readSavedDecks()
        if (decks[lastName]) {
          this.loadDeck(lastName)
        }
      }
      // Restore currency preference
      try {
        const savedCurrency = localStorage.getItem('op-currency')
        if (savedCurrency === 'USD' || savedCurrency === 'CAD') {
          this.currency = savedCurrency
        }
      } catch {}
    },

    /** Delete a saved deck from localStorage */
    deleteDeck(name: string) {
      const decks = readSavedDecks()
      delete decks[name]
      writeSavedDecks(decks)
      this._savedDecksVersion++
    },
  },
})
