<script setup lang="ts">
/**
 * Horizontal filter bar.
 *
 * Replaces the old 400px filter COLUMN, which stacked 7 label+button groups into
 * a 568px flex column inside a cell capped at 40% of viewport height — it needed
 * a 1420px-tall viewport to fit, so on a normal laptop a third of the filters
 * (Keyword, Sort) were permanently below the fold.
 *
 * Here the two highest-traffic controls (search, colour) are always visible and
 * everything else lives behind popovers, so the whole thing is one row and never
 * scrolls, whatever the viewport height.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useCardStore } from '../stores/cardStore'

const cardStore = useCardStore()

/** Which facet popover is open; only ever one at a time. */
const openFacet = ref<string | null>(null)
const barRef = ref<HTMLElement | null>(null)

/** Horizontal correction applied to a popover that would overflow the viewport. */
const popEl = ref<HTMLElement | null>(null)
const popShift = ref(0)
const popStyle = computed(() =>
  popShift.value ? { transform: `translateX(${popShift.value}px)` } : undefined
)

async function toggleFacet(name: string) {
  openFacet.value = openFacet.value === name ? null : name
  popShift.value = 0
  if (!openFacet.value) return
  await nextTick()
  const node = popEl.value
  if (!node) return
  const r = node.getBoundingClientRect()
  const overflowRight = r.right - (window.innerWidth - 8)
  if (overflowRight > 0) popShift.value = -overflowRight
  else if (r.left < 8) popShift.value = 8 - r.left
}

function onDocPointerDown(e: PointerEvent) {
  if (!openFacet.value) return
  if (barRef.value && !barRef.value.contains(e.target as Node)) openFacet.value = null
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && openFacet.value) {
    openFacet.value = null
  }
}
onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown)
  document.removeEventListener('keydown', onKeydown)
})

const COLORS = ['red', 'blue', 'green', 'purple', 'black', 'yellow'] as const
const TYPES = ['leader', 'character', 'event', 'stage'] as const
const RARITIES = [
  { value: 'l', label: 'L' }, { value: 'c', label: 'C' }, { value: 'uc', label: 'UC' },
  { value: 'r', label: 'R' }, { value: 'sr', label: 'SR' }, { value: 'sec', label: 'SEC' },
  { value: 'sp card', label: 'SP' }, { value: 'tr', label: 'TR' }, { value: 'p', label: 'P' },
]
const KEYWORDS = [
  { value: 'rush', label: 'Rush' },
  { value: 'blocker', label: 'Blocker' },
  { value: 'banish', label: 'Banish' },
  { value: 'double attack', label: 'Double Attack' },
  { value: 'searcher', label: 'Searcher' },
  { value: 'on k.o.', label: 'On KO' },
  { value: 'removal', label: 'Removal' },
  { value: 'anti-removal', label: 'Anti-Removal' },
]

/* Counts shown on each facet button so the user can see what's active without
   opening it — the old UI gave no indication once a group scrolled out of view. */
const typeCount = computed(() => cardStore.selectedTypes.length)
const rarityCount = computed(() => cardStore.selectedRarities.length)
const counterCount = computed(() => cardStore.selectedCounters.length)
const keywordCount = computed(() => cardStore.selectedKeywords.length)

const sortLabel = computed(() =>
  cardStore.costSortDirection === 'asc' ? 'Cost ↑'
    : cardStore.costSortDirection === 'desc' ? 'Cost ↓'
      : 'Sort'
)

/** Every active filter as a removable chip, so nothing is ever hidden. */
const activeChips = computed(() => {
  const chips: { key: string; label: string; clear: () => void }[] = []
  for (const c of cardStore.selectedColors) {
    chips.push({ key: `color:${c}`, label: c, clear: () => cardStore.toggleColor(c) })
  }
  for (const t of cardStore.selectedTypes) {
    chips.push({ key: `type:${t}`, label: t, clear: () => cardStore.toggleType(t) })
  }
  for (const r of cardStore.selectedRarities) {
    const label = RARITIES.find(x => x.value === r)?.label ?? r
    chips.push({ key: `rarity:${r}`, label, clear: () => cardStore.toggleRarity(r) })
  }
  for (const c of cardStore.selectedCounters) {
    chips.push({ key: `counter:${c}`, label: `${c / 1000}K counter`, clear: () => cardStore.toggleCounter(c) })
  }
  for (const k of cardStore.selectedKeywords) {
    const label = KEYWORDS.find(x => x.value === k)?.label ?? k
    chips.push({ key: `kw:${k}`, label, clear: () => cardStore.toggleKeyword(k) })
  }
  for (const term of cardStore.searchChips) {
    chips.push({ key: `q:${term}`, label: `"${term}"`, clear: () => cardStore.removeSearchChip(term) })
  }
  if (cardStore.hideRotated) {
    chips.push({ key: 'rotated', label: 'Standard only', clear: () => cardStore.toggleHideRotated() })
  }
  return chips
})

function clearAll() {
  cardStore.selectedColors = []
  cardStore.selectedTypes = []
  cardStore.selectedRarities = []
  cardStore.selectedCounters = []
  cardStore.selectedKeywords = []
  cardStore.clearSearchChips()
  cardStore.searchQuery = ''
  cardStore.hideRotated = false
  cardStore.costSortDirection = ''
}

/* ---- search ---- */
function handleEnter() {
  cardStore.commitSearchChip()
}
function handleBackspace(e: KeyboardEvent) {
  if (cardStore.searchQuery === '' && cardStore.searchChips.length > 0) {
    e.preventDefault()
    cardStore.searchChips.pop()
  }
}
</script>

<template>
  <div ref="barRef" class="filter-bar" data-tour="filters">
    <div class="bar-row">
      <!-- Search: the primary way in, so it gets the most room -->
      <div class="search">
        <svg class="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <input
          v-model="cardStore.searchQuery"
          type="text"
          class="search-input"
          placeholder="Search name, ID, set, attribute, type, or ability…"
          aria-label="Search cards"
          @keydown.enter.prevent="handleEnter"
          @keydown.delete="handleBackspace"
        />
        <button
          v-if="cardStore.searchQuery.trim()"
          class="search-commit"
          title="Add as a filter (Enter)"
          @click="handleEnter"
        >Add</button>
      </div>

      <!-- Colour: highest-traffic filter, always visible as swatches -->
      <div class="colors" role="group" aria-label="Colour">
        <button
          v-for="c in COLORS"
          :key="c"
          :class="['swatch', c, { active: cardStore.selectedColors.includes(c) }]"
          :title="c"
          :aria-pressed="cardStore.selectedColors.includes(c)"
          @click="cardStore.toggleColor(c)"
        ><span class="swatch-dot"></span><span class="swatch-label">{{ c }}</span></button>
      </div>

      <div class="divider"></div>

      <!-- Facet popovers -->
      <div class="facet">
        <button :class="['facet-btn', { on: typeCount > 0, open: openFacet === 'type' }]"
          @click="toggleFacet('type')" :aria-expanded="openFacet === 'type'">
          Type<span v-if="typeCount" class="badge">{{ typeCount }}</span>
          <svg class="chev" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        <div v-if="openFacet === 'type'" ref="popEl" :style="popStyle" class="pop">
          <button v-for="t in TYPES" :key="t"
            :class="['opt', { on: cardStore.selectedTypes.includes(t) }]"
            @click="cardStore.toggleType(t)">{{ t }}</button>
        </div>
      </div>

      <div class="facet">
        <button :class="['facet-btn', { on: rarityCount > 0, open: openFacet === 'rarity' }]"
          @click="toggleFacet('rarity')" :aria-expanded="openFacet === 'rarity'">
          Rarity<span v-if="rarityCount" class="badge">{{ rarityCount }}</span>
          <svg class="chev" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        <div v-if="openFacet === 'rarity'" ref="popEl" :style="popStyle" class="pop pop-grid">
          <button v-for="r in RARITIES" :key="r.value"
            :class="['opt', { on: cardStore.selectedRarities.includes(r.value) }]"
            @click="cardStore.toggleRarity(r.value)">{{ r.label }}</button>
        </div>
      </div>

      <div class="facet">
        <button :class="['facet-btn', { on: counterCount > 0, open: openFacet === 'counter' }]"
          @click="toggleFacet('counter')" :aria-expanded="openFacet === 'counter'">
          Counter<span v-if="counterCount" class="badge">{{ counterCount }}</span>
          <svg class="chev" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        <div v-if="openFacet === 'counter'" ref="popEl" :style="popStyle" class="pop">
          <button :class="['opt', { on: cardStore.selectedCounters.includes(1000) }]"
            @click="cardStore.toggleCounter(1000)">1000</button>
          <button :class="['opt', { on: cardStore.selectedCounters.includes(2000) }]"
            @click="cardStore.toggleCounter(2000)">2000</button>
        </div>
      </div>

      <div class="facet">
        <button :class="['facet-btn', { on: keywordCount > 0, open: openFacet === 'keyword' }]"
          @click="toggleFacet('keyword')" :aria-expanded="openFacet === 'keyword'">
          Keyword<span v-if="keywordCount" class="badge">{{ keywordCount }}</span>
          <svg class="chev" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        <div v-if="openFacet === 'keyword'" ref="popEl" :style="popStyle" class="pop pop-wide">
          <button v-for="k in KEYWORDS" :key="k.value"
            :class="['opt', { on: cardStore.selectedKeywords.includes(k.value) }]"
            @click="cardStore.toggleKeyword(k.value)">{{ k.label }}</button>
        </div>
      </div>

      <div class="facet">
        <button :class="['facet-btn', { on: cardStore.costSortDirection !== '', open: openFacet === 'sort' }]"
          @click="toggleFacet('sort')" :aria-expanded="openFacet === 'sort'">
          {{ sortLabel }}
          <svg class="chev" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        <div v-if="openFacet === 'sort'" ref="popEl" :style="popStyle" class="pop">
          <button :class="['opt', { on: cardStore.costSortDirection === '' }]"
            @click="cardStore.costSortDirection = ''">Default</button>
          <button :class="['opt', { on: cardStore.costSortDirection === 'asc' }]"
            @click="cardStore.costSortDirection = 'asc'">Cost: low to high</button>
          <button :class="['opt', { on: cardStore.costSortDirection === 'desc' }]"
            @click="cardStore.costSortDirection = 'desc'">Cost: high to low</button>
        </div>
      </div>

      <button
        :class="['facet-btn', 'standalone', { on: cardStore.hideRotated }]"
        :title="'Hide cards that rotated out of Standard on 2026-04-01 (OP01-OP04, ST01-ST09)'"
        :aria-pressed="cardStore.hideRotated"
        @click="cardStore.toggleHideRotated()"
      >Standard</button>
    </div>

    <!-- Active filters: nothing is ever hidden behind a closed popover -->
    <div v-if="activeChips.length" class="chip-row">
      <button v-for="chip in activeChips" :key="chip.key" class="chip" @click="chip.clear()">
        <span class="chip-label">{{ chip.label }}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
      <button class="chip-clear" @click="clearAll">Clear all</button>
    </div>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  background: var(--surface-raised);
  border-bottom: 1px solid var(--border-subtle);
}

.bar-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

/* ---- search ---- */
.search {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex: 1 1 200px;
  min-width: 150px;
  max-width: 420px;
  height: 32px;
  padding: 0 var(--space-3) 0 var(--space-4);
  background: var(--surface-canvas);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  transition: border-color var(--dur-fast) var(--ease-out);
}
.search:focus-within { border-color: var(--accent); }
.search-icon { color: var(--text-subtle); flex-shrink: 0; }
.search-input {
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  outline: none;
  color: var(--text-strong);
  font-size: var(--text-sm);
}
.search-input::placeholder { color: var(--text-subtle); }
.search-commit {
  flex-shrink: 0;
  padding: 2px var(--space-3);
  background: var(--accent);
  color: var(--on-accent);
  border-radius: var(--radius-sm);
  font-size: var(--text-2xs);
  font-weight: var(--weight-semibold);
}

/* ---- colour swatches ---- */
.colors { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.swatch {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: 32px;
  padding: 0 var(--space-3);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--surface-raised-2);
  color: var(--text-muted);
  font-size: var(--text-2xs);
  font-weight: var(--weight-semibold);
  text-transform: capitalize;
  transition: background var(--dur-fast) var(--ease-out),
              border-color var(--dur-fast) var(--ease-out),
              color var(--dur-fast) var(--ease-out);
}
.swatch:hover { background: var(--surface-hover); color: var(--text-default); }
.swatch-dot {
  width: 9px; height: 9px;
  border-radius: var(--radius-pill);
  background: var(--dot);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35) inset;
}
.swatch.red { --dot: var(--op-red); }
.swatch.blue { --dot: var(--op-blue); }
.swatch.green { --dot: var(--op-green); }
.swatch.purple { --dot: var(--op-purple); }
.swatch.black { --dot: var(--op-black); }
.swatch.yellow { --dot: var(--op-yellow); }
.swatch.active {
  color: var(--text-strong);
  border-color: var(--dot);
  background: color-mix(in srgb, var(--dot) 18%, transparent);
}

.divider {
  width: 1px;
  height: 20px;
  background: var(--border-default);
  flex-shrink: 0;
}

/* ---- facets ---- */
.facet { position: relative; }
.facet-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: 32px;
  padding: 0 var(--space-4);
  background: var(--surface-raised-2);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  white-space: nowrap;
  transition: background var(--dur-fast) var(--ease-out),
              border-color var(--dur-fast) var(--ease-out),
              color var(--dur-fast) var(--ease-out);
}
.facet-btn:hover { background: var(--surface-hover); color: var(--text-default); }
.facet-btn.open { border-color: var(--border-strong); color: var(--text-strong); }
.facet-btn.on {
  color: var(--text-strong);
  border-color: var(--accent);
  background: var(--accent-quiet);
}
.chev { opacity: 0.5; }
.badge {
  min-width: 15px;
  padding: 0 4px;
  background: var(--accent);
  color: var(--on-accent);
  border-radius: var(--radius-pill);
  font-size: 10px;
  font-weight: var(--weight-bold);
  text-align: center;
  line-height: 15px;
}

.pop {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: var(--z-popover);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 160px;
  padding: var(--space-3);
  background: var(--surface-overlay);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  animation: pop-in var(--dur-fast) var(--ease-out);
}
.pop-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  min-width: 190px;
}
.pop-wide {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  min-width: 240px;
}
/* Never let a popover exceed the window on a small screen. */
.pop { max-width: calc(100vw - 16px); }
@keyframes pop-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: none; }
}

.opt {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  text-align: left;
  text-transform: capitalize;
  white-space: nowrap;
  transition: background var(--dur-instant) var(--ease-out),
              color var(--dur-instant) var(--ease-out);
}
.opt:hover { background: var(--surface-hover); color: var(--text-strong); }
.opt.on { background: var(--accent-quiet); color: var(--text-strong); }
.pop-grid .opt { text-align: center; }

/* Narrow pane (the card finder as a rail): drop the colour names and tighten
   everything up. Six labelled swatches are ~390px of a 300px rail, which forced
   the bar to wrap to 227px — a third of the screen height on a 13" laptop. */
@container poolpane (max-width: 620px) {
  .swatch-label { display: none; }
  .swatch { padding: 0 var(--space-3); gap: 0; }
  .swatch-dot { width: 11px; height: 11px; }
  .search { flex: 1 1 100%; max-width: none; }
  .divider { display: none; }
  .facet-btn { padding: 0 var(--space-3); font-size: var(--text-2xs); }
}

/* ---- active filter chips ---- */
.chip-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.chip {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: 22px;
  padding: 0 var(--space-3);
  background: var(--surface-raised-2);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-pill);
  color: var(--text-muted);
  font-size: var(--text-2xs);
  font-weight: var(--weight-medium);
  text-transform: capitalize;
  transition: background var(--dur-instant) var(--ease-out),
              color var(--dur-instant) var(--ease-out),
              border-color var(--dur-instant) var(--ease-out);
}
.chip:hover {
  background: var(--accent-quiet);
  border-color: var(--accent);
  color: var(--text-strong);
}
.chip svg { opacity: 0.55; }
.chip:hover svg { opacity: 1; }
.chip-clear {
  padding: 0 var(--space-3);
  color: var(--text-subtle);
  font-size: var(--text-2xs);
  font-weight: var(--weight-medium);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.chip-clear:hover { color: var(--text-default); }
</style>
