<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, ref } from 'vue'
import { useCardStore } from './stores/cardStore'
import AppHeader from './components/AppHeader.vue'
import FilterBar from './components/FilterBar.vue'
import CardGrid from './components/CardGrid.vue'
import CardPreview from './components/CardPreview.vue'
import DeckDisplay from './components/DeckDisplay.vue'
import DeckStats from './components/DeckStats.vue'
import AppTour from './components/AppTour.vue'
import MobileLayout from './components/MobileLayout.vue'
import { useBreakpoint } from './composables/useBreakpoint'

// Loaded on demand. The share sheet drags in html-to-image and the proxy
// printer is ~1000 lines that most sessions never open — neither belongs in the
// chunk that blocks first paint.
const DeckShareModal = defineAsyncComponent(() => import('./components/DeckShareModal.vue'))
const ProxyPage = defineAsyncComponent(() => import('./components/ProxyPage.vue'))

const { isMobile } = useBreakpoint()
const cardStore = useCardStore()
cardStore.initStore()

const tourRef = ref<InstanceType<typeof AppTour> | null>(null)
const showShareModal = ref(false)
const currentView = ref<'builder' | 'proxy'>('builder')

function openShare() {
  if (cardStore.deckSize === 0) return
  showShareModal.value = true
}

/* ---------------------------------------------------------------------------
   Resizable split between the deck pane and the card pool.

   The old implementation attached a raw mousemove listener that wrote a ref on
   every single event — with a high-refresh mouse that's 125-1000 relayouts per
   second of the entire grid, including up to 51 absolutely-positioned deck
   images. This coalesces to one write per animation frame and uses pointer
   capture so the drag survives the cursor leaving the handle.
--------------------------------------------------------------------------- */
/* One pane flexes to fill the window and the other is a fixed-width rail;
   SIDE_* bounds the rail. Which pane is which is the user's call. */
const SIDE_MIN = 300
const SIDE_MAX = 760
const SIDE_DEFAULT = 420

function readStoredWidth(): number {
  try {
    const v = Number(localStorage.getItem('op-deck-pane-width'))
    if (Number.isFinite(v) && v >= SIDE_MIN && v <= SIDE_MAX) return v
  } catch { /* ignore */ }
  return SIDE_DEFAULT
}

/** Width of whichever pane is currently the narrow rail. */
const sideWidth = ref(readStoredWidth())
const isResizing = ref(false)

/** true = the DECK gets the large pane and the card finder becomes the rail. */
const deckPrimary = ref((() => {
  try { return localStorage.getItem('op-deck-primary') === '1' } catch { return false }
})())

function togglePrimary() {
  deckPrimary.value = !deckPrimary.value
  try { localStorage.setItem('op-deck-primary', deckPrimary.value ? '1' : '0') } catch { /* ignore */ }
}

let frame = 0
let latestX = 0
let activeHandle: HTMLElement | null = null
let activePointer: number | null = null

function applyWidth() {
  frame = 0
  const max = Math.min(SIDE_MAX, window.innerWidth - 420)
  // The divider always sits at the same boundary, but the rail is measured from
  // whichever edge it is anchored to — otherwise the drag runs backwards once
  // the deck takes the large pane.
  const fromEdge = deckPrimary.value ? window.innerWidth - latestX : latestX
  sideWidth.value = Math.min(max, Math.max(SIDE_MIN, fromEdge))
}

function onResizeMove(e: PointerEvent) {
  latestX = e.clientX
  if (!frame) frame = requestAnimationFrame(applyWidth)
}

function endResize() {
  isResizing.value = false
  if (frame) { cancelAnimationFrame(frame); frame = 0 }
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', endResize)
  window.removeEventListener('pointercancel', endResize)
  if (activeHandle && activePointer !== null) {
    try { activeHandle.releasePointerCapture(activePointer) } catch { /* already released */ }
  }
  activeHandle = null
  activePointer = null
  try { localStorage.setItem('op-deck-pane-width', String(sideWidth.value)) } catch { /* ignore */ }
}

function onResizeStart(e: PointerEvent) {
  e.preventDefault()
  isResizing.value = true
  activeHandle = e.currentTarget as HTMLElement
  activePointer = e.pointerId
  activeHandle.setPointerCapture(e.pointerId)
  latestX = e.clientX
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', endResize)
  window.addEventListener('pointercancel', endResize)
}

/** Double-click the divider to snap back to the default width. */
function resetWidth() {
  sideWidth.value = SIDE_DEFAULT
  try { localStorage.setItem('op-deck-pane-width', String(SIDE_DEFAULT)) } catch { /* ignore */ }
}

onBeforeUnmount(endResize)

const shellStyle = computed(() => ({
  gridTemplateColumns: deckPrimary.value
    ? `1fr ${sideWidth.value}px`   // deck flexes, card finder is the rail
    : `${sideWidth.value}px 1fr`,  // deck is the rail, card finder flexes
}))
</script>

<template>
  <ProxyPage v-if="currentView === 'proxy'" @back="currentView = 'builder'" />

  <MobileLayout
    v-else-if="isMobile"
    @navigate="currentView = $event"
    @share="openShare"
  />

  <div v-else class="shell" :class="{ resizing: isResizing, 'deck-primary': deckPrimary }" :style="shellStyle">
    <AppHeader
      :deck-primary="deckPrimary"
      @swap="togglePrimary"
      @share="openShare"
      @proxy="currentView = 'proxy'"
      @tour="tourRef?.start()"
    />

    <!-- LEFT: the deck being built -->
    <section class="deck-pane" data-tour="deck-area">
      <div class="deck-scroll" @mouseleave="cardStore.clearSelectedCardSoon()">
        <DeckDisplay />
      </div>
      <div class="deck-stats-pane">
        <DeckStats />
      </div>
      <div
        class="col-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize deck panel"
        title="Drag to resize · double-click to reset"
        @pointerdown="onResizeStart"
        @dblclick="resetWidth"
      ></div>
    </section>

    <!-- RIGHT: the card pool, which now gets the room -->
    <section class="pool-pane">
      <FilterBar />
      <div class="pool-scroll" data-tour="card-pool" @mouseleave="cardStore.clearSelectedCardSoon()">
        <CardGrid />
      </div>
    </section>

    <CardPreview />
    <AppTour ref="tourRef" />
  </div>

  <!-- Outside the shell so mobile and desktop can both open it -->
  <DeckShareModal :open="showShareModal" @close="showShareModal = false" />
</template>

<style scoped>
/*
  Two columns under a fixed header:

    "header  header"   52px
    "deck    pool"     1fr

  The previous layout was a 2x3 grid whose bottom row was hardcoded to `3fr 2fr`
  with a fixed 400px filter column. Measured on a 1600x950 viewport that gave the
  deck area 41% of the screen (empty until you add cards), the sidebar 31% (empty
  until you hover), the filters 10% (overflowing by 188px), and the card pool
  about 18% — roughly nine of 4789 cards visible at a time. Filters moved into a
  horizontal bar and the preview became a floating overlay, so both of those
  columns collapse into the pool.
*/
.shell {
  display: grid;
  grid-template-areas:
    "header header"
    "deck   pool";
  /* minmax(0, 1fr) not 1fr: a grid track sized `1fr` still has min-height:auto,
     so a tall child stretches the row past the container instead of scrolling
     inside it. Measured the deck pane at ~28000px tall before this. */
  grid-template-rows: 52px minmax(0, 1fr);
  height: 100vh;
  height: 100dvh;
  background: var(--surface-canvas);
  overflow: hidden;
}

.shell.resizing {
  user-select: none;
  cursor: col-resize;
}

/* ---- deck pane ---- */
.deck-pane {
  grid-area: deck;
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--surface-raised);
  border-right: 1px solid var(--border-subtle);
}


.deck-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-5);
  /* Isolate the deck's layout/paint from the pool so scrolling one doesn't
     invalidate the other. */
  contain: layout paint;
}

.deck-stats-pane {
  flex-shrink: 0;
  max-height: 40%;
  transition: max-height var(--dur-base) var(--ease-out);
  overflow-y: auto;
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--border-subtle);
  background: var(--surface-raised-2);
}

/* Wide hit area, thin visual. The old handles were 5px and fully transparent
   until hover, with no affordance at all. */
.col-handle {
  position: absolute;
  top: 0;
  right: -4px;
  width: 9px;
  height: 100%;
  z-index: var(--z-float);
  cursor: col-resize;
  touch-action: none;
}
.col-handle::after {
  content: '';
  position: absolute;
  top: 0;
  left: 4px;
  width: 1px;
  height: 100%;
  background: transparent;
  transition: background var(--dur-fast) var(--ease-out);
}
.col-handle:hover::after,
.shell.resizing .col-handle::after {
  background: var(--accent);
}

/* ---- pool pane ---- */
.pool-pane {
  grid-area: pool;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--surface-canvas);
}

/* Given the large pane, the deck has room for the chart without crowding the
   cards, so cap the stats strip lower. */
.shell.deck-primary .deck-stats-pane { max-height: 30%; }

.pool-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-5);
  /* Lets the grid size its tracks against this element's width rather than the
     viewport, so dragging the divider reflows the columns correctly. */
  container-type: inline-size;
  container-name: cardpool;
  contain: layout paint;
}
</style>
