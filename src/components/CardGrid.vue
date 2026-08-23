<script setup lang="ts">
import { ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useCardStore } from '../stores/cardStore'
import { useBreakpoint } from '../composables/useBreakpoint'
import CardThumbnail from './CardThumbnail.vue'
import type { Card } from '../types/Card'

const cardStore = useCardStore()

/*
  ONE breakpoint subscription for the whole pool.
  Every CardThumbnail used to call useBreakpoint(), which registers an
  onMounted + onUnmounted pair per instance. With hundreds of tiles that is
  hundreds of lifecycle hooks doing nothing useful. Hoisted here and handed
  down as a plain prop instead.
*/
const { isMobile } = useBreakpoint()

/* ---------------------------------------------------------------------------
   Windowed (virtualised) grid.

   The pool is a perfectly uniform grid, so we do not need a generic virtual
   list library: given the container width we can derive the column count, the
   tile width, and therefore the exact height of every row. From scrollTop we
   then derive which row range is on screen and render only those rows (plus a
   small overscan). Everything else is replaced by a single spacer element of
   the correct total height, so the scrollbar behaves exactly as if all cards
   were mounted.
--------------------------------------------------------------------------- */

/** One Piece card aspect ratio (matches --card-aspect: 63 / 88). */
const CARD_RATIO = 88 / 63

/** Extra rows rendered above and below the viewport. */
const OVERSCAN_ROWS = 2

/** Rough height of the mobile tile's name + qty controls + border.
 *  Only a first guess: `calibrate()` replaces it with a real measurement. */
const MOBILE_TILE_CHROME = 62

/** Hover-preview debounce. Sweeping a mouse across a row used to fire one
 *  full preview re-render (and a 124KB image swap) per tile passed over. */
const HOVER_DELAY_MS = 80

const rootEl = ref<HTMLElement | null>(null)
const gridEl = ref<HTMLElement | null>(null)
const scrollEl = shallowRef<HTMLElement | null>(null)

const containerWidth = ref(0)
/** Height of the band of the scroll container that is actually on screen. */
const viewportHeight = ref(0)
const scrollTop = ref(0)
/** scrollTop → first on-screen pixel, when the container is clipped by the
 *  window (0 in the normal case where the container fits the window). */
const bandOffset = ref(0)
/** Distance from the top of the scroll container's content to the grid. */
const gridTop = ref(0)

/* Track sizing is owned by CSS (see the @container / @media rules below) and
   read back here, so the virtualisation math can never disagree with layout. */
const tileMin = ref(140)
const tileMax = ref(190)
const gap = ref(10)

/** Real row stride once we have measured a rendered row; 0 = use the estimate. */
const measuredStride = ref(0)

const allCards = computed(() => cardStore.filteredCards)

/**
 * Column count that keeps every tile inside [tileMin, tileMax].
 *  - `byMin` is the most columns that still leaves each tile >= tileMin.
 *  - `byMax` is the fewest columns that keeps each tile <= tileMax.
 * Taking the larger packs the row densely and leaves no dead horizontal space.
 */
const columns = computed(() => {
  const w = containerWidth.value
  if (w <= 0) return 0
  const g = gap.value
  const byMin = Math.floor((w + g) / (tileMin.value + g))
  const byMax = Math.ceil((w + g) / (tileMax.value + g))
  return Math.max(1, byMin, byMax)
})

const tileWidth = computed(() => {
  const cols = columns.value
  if (cols <= 0) return 0
  return (containerWidth.value - gap.value * (cols - 1)) / cols
})

/** Row pitch = tile height + gap. */
const estimatedStride = computed(() => {
  const chrome = isMobile.value ? MOBILE_TILE_CHROME : 0
  return tileWidth.value * CARD_RATIO + chrome + gap.value
})

const rowStride = computed(() =>
  Math.max(1, measuredStride.value > 0 ? measuredStride.value : estimatedStride.value)
)

const totalRows = computed(() => {
  const cols = columns.value
  return cols > 0 ? Math.ceil(allCards.value.length / cols) : 0
})

const totalHeight = computed(() =>
  totalRows.value > 0 ? Math.max(0, totalRows.value * rowStride.value - gap.value) : 0
)

/** Offset of the first on-screen pixel, in grid-content coordinates. */
const windowTop = computed(() => scrollTop.value + bandOffset.value - gridTop.value)

const startRow = computed(() => {
  if (totalRows.value === 0) return 0
  const raw = Math.floor(windowTop.value / rowStride.value) - OVERSCAN_ROWS
  return Math.min(Math.max(0, raw), Math.max(0, totalRows.value - 1))
})

const endRow = computed(() => {
  if (totalRows.value === 0) return 0
  const raw = Math.ceil((windowTop.value + viewportHeight.value) / rowStride.value) + OVERSCAN_ROWS
  return Math.min(totalRows.value, Math.max(startRow.value + 1, raw))
})

/**
 * The only cards that are actually mounted, grouped into rows.
 *
 * Each row is absolutely positioned at its own `top`, rather than the whole
 * window being one grid pushed down by a translate. It costs one extra div per
 * row and buys exactly one thing: a tile that survives a window move keeps its
 * layout position *unchanged*, so the browser records no layout shift. With a
 * single translated container every visible tile changes grid position on every
 * row boundary — measured at 0.084 of layout shift per row crossed, ~5.1
 * cumulative over a normal scroll through the pool.
 */
const visibleRows = computed<{ i: number; cards: Card[] }[]>(() => {
  const cols = columns.value
  if (cols <= 0) return []
  const list = allCards.value
  const rows: { i: number; cards: Card[] }[] = []
  for (let r = startRow.value; r < endRow.value; r++) {
    rows.push({ i: r, cards: list.slice(r * cols, r * cols + cols) })
  }
  return rows
})

function rowStyle(i: number) {
  return {
    top: `${i * rowStride.value}px`,
    gridTemplateColumns: `repeat(${Math.max(1, columns.value)}, 1fr)`,
    columnGap: `${gap.value}px`,
  }
}

/* ------------------------------ measurement ------------------------------ */

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = el?.parentElement ?? null
  while (node) {
    const oy = getComputedStyle(node).overflowY
    if (oy === 'auto' || oy === 'scroll' || oy === 'overlay') return node
    node = node.parentElement
  }
  return null
}

function measure() {
  const root = rootEl.value
  if (!root) return

  // Track sizing tokens come from CSS so @container rules stay authoritative.
  const cs = getComputedStyle(root)
  const min = parseFloat(cs.getPropertyValue('--tile-min'))
  const max = parseFloat(cs.getPropertyValue('--tile-max'))
  const g = parseFloat(cs.getPropertyValue('--grid-gap'))
  if (Number.isFinite(min) && min > 0) tileMin.value = min
  if (Number.isFinite(max) && max > 0) tileMax.value = max
  if (Number.isFinite(g) && g >= 0) gap.value = g

  // Keep the last good width: the mobile cards tab is v-show'd, so the
  // element reports 0 while hidden.
  const w = root.clientWidth
  if (w > 0) containerWidth.value = w

  const winH = window.innerHeight || document.documentElement.clientHeight || 0
  const sc = scrollEl.value

  if (sc) {
    /*
      Take the band where the scroll container actually intersects the window,
      not its full clientHeight. That matters for more than correctness: this
      component's spacer is what gives the pool its scroll height, so if an
      ancestor ever fails to constrain the container (a flex item without
      `min-height: 0`, say), clientHeight grows with our own output. Reading it
      raw is then a feedback loop — a taller container renders more rows, which
      makes the container taller. Clamping to the window makes the window count
      bounded no matter how the surrounding layout behaves.
    */
    const rect = sc.getBoundingClientRect()
    const top = Math.max(rect.top, 0)
    const bottom = Math.min(rect.bottom, winH)
    viewportHeight.value = Math.max(0, bottom - top)
    bandOffset.value = top - rect.top
    gridTop.value = root.getBoundingClientRect().top - rect.top + sc.scrollTop
    scrollTop.value = sc.scrollTop
  } else {
    viewportHeight.value = winH
    bandOffset.value = 0
    gridTop.value = root.getBoundingClientRect().top + window.scrollY
    scrollTop.value = window.scrollY
  }
}

/**
 * Replace the estimated row pitch with the real one, taken from a rendered
 * tile. Desktop tiles are pure aspect-ratio boxes so the estimate is already
 * exact; this exists so the mobile tile (artwork + name + qty controls) never
 * needs a hardcoded chrome height.
 *
 * Measuring ONE tile — rather than dividing the grid's height by the row count
 * we think we rendered — keeps this immune to reading a DOM that has not caught
 * up with the reactive state yet.
 */
function calibrate() {
  if (measuredStride.value > 0) return
  const first = gridEl.value?.firstElementChild as HTMLElement | null
  if (!first) return
  const h = first.getBoundingClientRect().height
  if (h <= 0) return
  const stride = h + gap.value
  if (Math.abs(stride - rowStride.value) > 0.5) measuredStride.value = stride
}

/* -------------------------------- scrolling ------------------------------- */

/*
  Deliberately synchronous, not rAF-throttled. Scroll events fire before the
  frame is painted, and `startRow` / `endRow` are computeds — if the row window
  has not moved they re-evaluate to the same numbers and Vue stops propagation,
  so a scroll event that stays inside the current window costs one integer
  division and nothing else. When the window *does* move, updating here means
  the new rows are in the DOM before that same frame paints, so the content
  never lags the scrollbar by a frame (which is what makes naive virtual lists
  flicker and rack up layout-shift).
*/
function onScroll() {
  const sc = scrollEl.value
  scrollTop.value = sc ? sc.scrollTop : window.scrollY
}

/* ----------------------------- hover preview ------------------------------ */

let hoverTimer: ReturnType<typeof setTimeout> | undefined

function onPreview(card: Card) {
  if (hoverTimer) {
    clearTimeout(hoverTimer)
    hoverTimer = undefined
  }
  if (cardStore.selectedCard?.id === card.id) return
  // Mobile preview comes from a deliberate tap, so it should feel instant.
  if (isMobile.value) {
    cardStore.selectCard(card)
    return
  }
  hoverTimer = setTimeout(() => {
    hoverTimer = undefined
    cardStore.selectCard(card)
  }, HOVER_DELAY_MS)
}

/* -------------------------------- lifecycle ------------------------------- */

let ro: ResizeObserver | null = null

onMounted(() => {
  scrollEl.value = findScrollParent(rootEl.value)
  const target: HTMLElement | Window = scrollEl.value ?? window
  target.addEventListener('scroll', onScroll, { passive: true })

  window.addEventListener('resize', measure, { passive: true })

  ro = new ResizeObserver(() => measure())
  if (rootEl.value) ro.observe(rootEl.value)
  if (scrollEl.value) ro.observe(scrollEl.value)

  measure()
  nextTick(calibrate)
})

onBeforeUnmount(() => {
  const target: HTMLElement | Window = scrollEl.value ?? window
  target.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', measure)
  ro?.disconnect()
  ro = null
  if (hoverTimer) clearTimeout(hoverTimer)
})

// Tile geometry changed → the cached row pitch is stale.
watch([tileWidth, gap, isMobile], () => {
  measuredStride.value = 0
  nextTick(calibrate)
})

watch(visibleRows, () => {
  if (measuredStride.value === 0) nextTick(calibrate)
})

// New result set → back to the top of the pool, then re-measure.
watch(allCards, () => {
  const sc = scrollEl.value
  if (sc) sc.scrollTop = 0
  scrollTop.value = 0
  nextTick(measure)
})
</script>

<template>
  <div ref="rootEl" class="card-pool-grid">
    <div v-if="!cardStore.hasActiveFilters" class="no-filters">
      Select a color or type a search to browse cards
    </div>

    <!--
      Spacer sized to the full (virtual) grid so the scrollbar is correct, with
      only the on-screen rows mounted inside it, each parked at its own `top`.
    -->
    <div
      v-else
      ref="gridEl"
      class="grid-viewport"
      :style="{ height: `${totalHeight}px` }"
    >
      <div
        v-for="row in visibleRows"
        :key="row.i"
        class="card-row"
        :style="rowStyle(row.i)"
      >
        <CardThumbnail
          v-for="card in row.cards"
          :key="card.id"
          :card="card"
          :is-mobile="isMobile"
          @select="cardStore.addToDeck"
          @preview="onPreview"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
  Track sizing lives in CSS so the design stays editable here, and is read back
  by the script (via getComputedStyle) so the virtualisation math and the actual
  layout can never disagree.

  The pool's scroll container (App.vue) declares `container-type: inline-size;
  container-name: cardpool`, which is what makes the @container rule below
  work: the grid responds to the pool's own width, so dragging the layout
  divider reflows the tracks — a viewport media query cannot see that.
*/
.card-pool-grid {
  --tile-min: 140px;
  --tile-max: 190px;
  --grid-gap: var(--space-5); /* 12px */
}

/* Very narrow pool (deck pane dragged most of the way across): below this the
   140px floor would force tiles wider than the pool reads well at, so drop the
   whole band rather than leave one giant column. */
@container cardpool (max-width: 420px) {
  .card-pool-grid {
    --tile-min: 118px;
    --tile-max: 158px;
    --grid-gap: var(--space-4); /* 8px */
  }
}

/* Phones/tablets render the taller mobile tile; there is no `cardpool`
   container in the mobile layout, so this is a plain viewport query. */
@media (max-width: 767px) {
  .card-pool-grid {
    --tile-min: 115px;
    --tile-max: 170px;
    --grid-gap: var(--space-3); /* 6px */
  }
}

.grid-viewport {
  position: relative;
  width: 100%;
}

.card-row {
  position: absolute;
  left: 0;
  right: 0;
  display: grid;
  /* Fallback for the single frame before the first measurement lands; the
     inline style takes over immediately after. */
  grid-template-columns: repeat(auto-fill, minmax(var(--tile-min), 1fr));
  column-gap: var(--grid-gap);
  contain: layout style;
}

.no-filters {
  color: var(--text-muted);
  font-size: var(--text-base);
  text-align: center;
  padding: var(--space-10) var(--space-7);
}
</style>
