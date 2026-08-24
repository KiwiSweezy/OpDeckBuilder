<script setup lang="ts">
/**
 * Floating card preview.
 *
 * Previously the preview owned a permanent slab of the left sidebar — 31% of the
 * screen sitting empty and reading "Hover a card to preview" until you moved the
 * mouse. Here it's an overlay that only exists while a card is selected.
 *
 * It is draggable: grab it anywhere and drop it where you want. Until it's been
 * moved it auto-docks to whichever side the pointer ISN'T on, so it never covers
 * the card you're currently hovering. Once you place it by hand that position is
 * kept (and persisted), because fighting the user's chosen spot is worse than
 * occasionally overlapping something.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useCardStore } from '../stores/cardStore'
import { useCardPrice } from '../composables/useCardPrice'
import { formatPrice, tcgplayerUrl } from '../utils/pricing'
import { copyToClipboard } from '../utils/clipboard'

const cardStore = useCardStore()
const card = computed(() => cardStore.selectedCard)

const cardId = computed(() => card.value?.id ?? null)
const { price } = useCardPrice(cardId)
const priceText = computed(() =>
  price.value === null
    ? null
    : formatPrice(price.value, cardStore.currency, { CAD: 1.38, GBP: 0.79 })
)

/* ------------------------------- position -------------------------------- */

const PANEL_W = 360
const POS_KEY = 'op-preview-pos'
const MARGIN = 12

const el = ref<HTMLElement | null>(null)
/** null = auto-dock; an object = a position the user chose. */
const pos = ref<{ x: number; y: number } | null>(readStoredPos())
const dragging = ref(false)
/** Which edge to auto-dock against, when the user hasn't placed it. */
const dockSide = ref<'left' | 'right'>('left')

function readStoredPos(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(POS_KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    if (typeof p?.x === 'number' && typeof p?.y === 'number') return p
  } catch { /* ignore */ }
  return null
}

function clampToViewport(x: number, y: number) {
  const h = el.value?.offsetHeight ?? 520
  return {
    x: Math.min(Math.max(MARGIN, x), Math.max(MARGIN, window.innerWidth - PANEL_W - MARGIN)),
    y: Math.min(Math.max(MARGIN, y), Math.max(MARGIN, window.innerHeight - h - MARGIN)),
  }
}

/** Last known pointer X, used only to choose a docking edge. */
let lastPointerX = 0
let overPanel = false

/* Hover state is derived from GEOMETRY on every pointermove, not from
 * pointerenter/pointerleave.
 *
 * Those events proved unreliable here for two separate reasons: the browser
 * emits `pointerenter` on this panel before `mouseleave` on the pool it floats
 * above, and releasing pointer capture after a drag can leave the pointer
 * physically inside the panel without any further boundary event. A hit test
 * against the panel's own rect has neither problem. */
function trackPointer(e: PointerEvent) {
  lastPointerX = e.clientX
  if (dragging.value) return

  const r = el.value?.getBoundingClientRect()
  const inside = !!r
    && e.clientX >= r.left && e.clientX <= r.right
    && e.clientY >= r.top && e.clientY <= r.bottom

  if (inside === overPanel) return
  overPanel = inside
  cardStore.setPreviewHovered(inside)
  if (!inside) cardStore.clearSelectedCardSoon()
}

/* Pick the docking edge only when the panel APPEARS (null -> a card), never
 * while it is already on screen.
 *
 * The panel floats above the pool, so moving the pointer onto it also lands it
 * over the tiles underneath; re-deciding the edge on every card change made the
 * panel jump to the opposite side the moment you reached for it, which also
 * meant a drag could never start because pointerdown landed where it used to be. */
watch(cardId, (id, prev) => {
  if (!id || pos.value || prev) return
  dockSide.value = lastPointerX < window.innerWidth / 2 ? 'right' : 'left'
}, { immediate: true })

const panelStyle = computed(() => {
  if (pos.value) {
    return { left: `${pos.value.x}px`, top: `${pos.value.y}px`, right: 'auto', bottom: 'auto' }
  }
  return dockSide.value === 'left'
    ? { left: `${MARGIN}px`, bottom: `${MARGIN}px`, right: 'auto', top: 'auto' }
    : { right: `${MARGIN}px`, bottom: `${MARGIN}px`, left: 'auto', top: 'auto' }
})

/* --------------------------------- drag ---------------------------------- */

let offX = 0
let offY = 0
let frame = 0
let nextX = 0
let nextY = 0
let pointerId: number | null = null

function applyDrag() {
  frame = 0
  pos.value = clampToViewport(nextX, nextY)
}

function onDragMove(e: PointerEvent) {
  nextX = e.clientX - offX
  nextY = e.clientY - offY
  if (!frame) frame = requestAnimationFrame(applyDrag)
}

function endDrag() {
  if (!dragging.value) return
  dragging.value = false
  if (frame) { cancelAnimationFrame(frame); frame = 0 }
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointercancel', endDrag)
  if (el.value && pointerId !== null) {
    try { el.value.releasePointerCapture(pointerId) } catch { /* already gone */ }
  }
  pointerId = null
  try { localStorage.setItem(POS_KEY, JSON.stringify(pos.value)) } catch { /* ignore */ }
}

function onPointerDown(e: PointerEvent) {
  // Leave the genuinely interactive bits alone.
  if ((e.target as HTMLElement).closest('.id, .tcg, .reset')) return
  if (!el.value || e.button !== 0) return
  e.preventDefault()

  const r = el.value.getBoundingClientRect()
  offX = e.clientX - r.left
  offY = e.clientY - r.top
  // Convert from auto-dock to explicit coordinates at the current spot so the
  // panel doesn't jump under the cursor on the first move.
  pos.value = { x: r.left, y: r.top }
  dragging.value = true
  pointerId = e.pointerId
  cardStore.cancelClearSelectedCard()
  try { el.value.setPointerCapture(e.pointerId) } catch { /* not fatal */ }

  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', endDrag)
  window.addEventListener('pointercancel', endDrag)
}

/** Send it back to auto-docking. */
function resetPosition() {
  pos.value = null
  try { localStorage.removeItem(POS_KEY) } catch { /* ignore */ }
}

function onWindowResize() {
  if (pos.value) pos.value = clampToViewport(pos.value.x, pos.value.y)
}

onMounted(() => {
  window.addEventListener('pointermove', trackPointer, { passive: true })
  window.addEventListener('resize', onWindowResize)
})
onBeforeUnmount(() => {
  endDrag()
  overPanel = false
  cardStore.setPreviewHovered(false)
  window.removeEventListener('pointermove', trackPointer)
  window.removeEventListener('resize', onWindowResize)
})

/* -------------------------------- content -------------------------------- */

const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | undefined
function copyId() {
  if (!card.value) return
  if (copyToClipboard(card.value.id)) {
    copied.value = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copied.value = false }, 1400)
  }
}
watch(cardId, () => { copied.value = false })
onBeforeUnmount(() => clearTimeout(copyTimer))

const keywords = computed(() => {
  const c = card.value
  if (!c) return []
  const a = c.ability.toLowerCase()
  const out: string[] = []
  if (a.includes('blocker')) out.push('Blocker')
  if (a.includes('rush')) out.push('Rush')
  if (a.includes('banish')) out.push('Banish')
  if (a.includes('double attack')) out.push('Double Attack')
  if (a.includes('on k.o.')) out.push('On KO')
  if (/look at.*from the top of your deck/.test(a)) out.push('Searcher')
  if (c.trigger) out.push('Trigger')
  return out
})

const abilityText = computed(() =>
  (card.value?.ability ?? '').replace(/<br>/g, '\n').trim()
)
</script>

<template>
  <Transition name="preview">
    <aside
      v-if="card"
      ref="el"
      class="preview"
      :class="{ dragging, placed: !!pos }"
      :style="panelStyle"
      aria-live="polite"
      @pointerdown="onPointerDown"
    >
      <!-- Drag affordance: always faintly present, brightens on hover -->
      <div class="drag-bar">
        <span class="grip" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
            <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
            <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
          </svg>
        </span>
        <span class="drag-hint">Drag to move</span>
        <button
          v-if="pos"
          class="reset"
          title="Snap back to the edge"
          @pointerdown.stop
          @click="resetPosition"
        >Reset</button>
      </div>

      <img
        :src="card.images.large"
        :alt="card.name"
        class="preview-img"
        width="600"
        height="838"
        decoding="async"
        draggable="false"
      />

      <div class="body">
        <div class="head">
          <h2 class="name">{{ card.name }}</h2>
          <a
            class="tcg"
            :href="tcgplayerUrl(card.id)"
            target="_blank"
            rel="noopener noreferrer"
            title="Look up on TCGplayer"
            @pointerdown.stop
          >
            <span v-if="priceText" class="price">{{ priceText }}</span>
            <span v-else class="price muted">—</span>
          </a>
        </div>

        <div class="meta">
          <button class="id" :title="`Copy ${card.id}`" @pointerdown.stop @click="copyId">
            {{ copied ? 'Copied' : card.id }}
          </button>
          <span class="tag">{{ card.type }}</span>
          <span class="tag">{{ card.rarity.toUpperCase() }}</span>
          <span v-if="card.set" class="tag">{{ card.set }}</span>
        </div>

        <div class="stats">
          <span><b>{{ card.cost }}</b> {{ card.type === 'leader' ? 'Life' : 'Cost' }}</span>
          <span v-if="card.power"><b>{{ card.power }}</b> Power</span>
          <span v-if="card.counter"><b>{{ card.counter }}</b> Counter</span>
          <span v-if="card.attribute">{{ card.attribute }}</span>
        </div>

        <p v-if="card.family" class="family">{{ card.family }}</p>

        <div v-if="keywords.length" class="kws">
          <span v-for="k in keywords" :key="k" class="kw">{{ k }}</span>
        </div>

        <p v-if="abilityText && abilityText !== '-'" class="ability">{{ abilityText }}</p>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.preview {
  position: fixed;
  z-index: var(--z-float);
  width: 360px;
  /* A FIXED height, not max-height. The panel docks against the bottom edge, so
     letting it size to content made its top edge — and therefore the drag
     handle — jump every time you hovered a card with a different amount of
     ability text. Overflow scrolls in .body instead. */
  height: min(720px, calc(100vh - 88px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--surface-overlay);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  cursor: grab;
  /* Never let a drag select the card text underneath. */
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}

.preview.dragging {
  cursor: grabbing;
  box-shadow: var(--shadow-lg), 0 0 0 1px var(--accent);
  /* Drop the transition while dragging so it tracks the pointer exactly. */
  transition: none;
}

/* ---- drag affordance ---- */
.drag-bar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--surface-raised-2);
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-subtle);
  /* Visible but quiet at rest, so the panel reads as draggable without
     shouting; full strength once the pointer is on it. */
  opacity: 0.6;
  transition: opacity var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
}
.preview:hover .drag-bar,
.preview.dragging .drag-bar {
  opacity: 1;
  color: var(--text-muted);
}
.grip { display: flex; }
.drag-hint {
  flex: 1;
  font-size: var(--text-2xs);
  font-weight: var(--weight-medium);
  letter-spacing: 0.02em;
}
.reset {
  padding: 1px var(--space-3);
  border-radius: var(--radius-xs);
  background: var(--surface-hover);
  color: var(--text-muted);
  font-size: var(--text-2xs);
  font-weight: var(--weight-semibold);
  cursor: pointer;
  transition: background var(--dur-instant) var(--ease-out), color var(--dur-instant) var(--ease-out);
}
.reset:hover { background: var(--accent); color: var(--on-accent); }

.preview-img {
  width: 100%;
  height: auto;
  flex-shrink: 0;
  aspect-ratio: var(--card-aspect);
  object-fit: cover;
  background: var(--surface-sunken);
  pointer-events: none;
}

.body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5) var(--space-5);
  overflow-y: auto;
}

.head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); }
.name {
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--text-strong);
  line-height: var(--leading-tight);
}
.tcg { text-decoration: none; cursor: pointer; }
.price {
  color: var(--positive);
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.price.muted { color: var(--text-subtle); }

.meta { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
.id {
  padding: 1px var(--space-3);
  background: var(--surface-canvas);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xs);
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  cursor: pointer;
  transition: color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
}
.id:hover { color: var(--text-strong); border-color: var(--accent); }
.tag {
  padding: 1px var(--space-3);
  border-radius: var(--radius-xs);
  background: var(--surface-hover);
  color: var(--text-subtle);
  font-size: var(--text-2xs);
  font-weight: var(--weight-medium);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  color: var(--text-muted);
  font-size: var(--text-sm);
}
.stats b {
  color: var(--text-strong);
  font-variant-numeric: tabular-nums;
  font-weight: var(--weight-semibold);
}

.family { color: var(--text-subtle); font-size: var(--text-xs); font-style: italic; }

.kws { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.kw {
  padding: 1px var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--accent-quiet);
  color: var(--accent);
  font-size: var(--text-2xs);
  font-weight: var(--weight-semibold);
}

.ability {
  color: var(--text-default);
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
  white-space: pre-line;
  /* Ability text is the one thing worth selecting. */
  user-select: text;
  -webkit-user-select: text;
}

/* Fast and subtle — the preview follows the pointer around, so anything
   slower reads as lag rather than polish. */
.preview-enter-active { transition: opacity var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
.preview-leave-active { transition: opacity var(--dur-instant) var(--ease-out); }
.preview-enter-from { opacity: 0; transform: translateY(6px); }
.preview-leave-to { opacity: 0; }
</style>
