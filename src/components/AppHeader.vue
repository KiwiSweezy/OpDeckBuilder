<script setup lang="ts">
/**
 * Desktop app header — one fixed row holding identity, deck management and the
 * high-frequency actions.
 *
 * Replaces the old left-sidebar control stack. Those controls were four
 * full-width buttons inside a panel that also had to hold the card preview and
 * the stats chart; putting them in a header frees the entire left column for
 * the deck itself, and these buttons stop scrolling away (the old Share / Proxy
 * / price pills were position:absolute inside an overflow-y:auto panel, so they
 * slid off the top as soon as the deck got tall).
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useCardStore } from '../stores/cardStore'
import { useDeckTotal } from '../composables/useDeckTotal'
import { copyToClipboard } from '../utils/clipboard'

const emit = defineEmits<{ share: []; proxy: []; tour: [] }>()

const cardStore = useCardStore()
const deckTotal = useDeckTotal()

const status = ref('')
let statusTimer: ReturnType<typeof setTimeout> | undefined
function flash(msg: string) {
  status.value = msg
  clearTimeout(statusTimer)
  statusTimer = setTimeout(() => { status.value = '' }, 2200)
}

/* ---- menus ---- */
const openMenu = ref<'decks' | 'file' | null>(null)
const headerRef = ref<HTMLElement | null>(null)
function toggleMenu(m: 'decks' | 'file') {
  openMenu.value = openMenu.value === m ? null : m
}
function onDocPointerDown(e: PointerEvent) {
  if (openMenu.value && headerRef.value && !headerRef.value.contains(e.target as Node)) {
    openMenu.value = null
  }
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') openMenu.value = null
}
onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown)
  document.removeEventListener('keydown', onKeydown)
  clearTimeout(statusTimer)
})

/* ---- deck management ---- */
const showOverwrite = ref(false)

function handleSave() {
  const name = cardStore.deckName.trim()
  if (!name || cardStore.deckSize === 0) {
    flash(cardStore.saveDeck())
    return
  }
  if (cardStore.hasSavedDeck(name)) {
    showOverwrite.value = true
    return
  }
  confirmSave()
}
function confirmSave() {
  showOverwrite.value = false
  flash(cardStore.saveDeck())
}
function handleNew() {
  cardStore.deckName = ''
  cardStore.clearDeck()
  openMenu.value = null
  flash('New deck')
}
function handleLoad(name: string) {
  flash(cardStore.loadDeck(name))
  openMenu.value = null
}
function handleDelete(name: string) {
  cardStore.deleteDeck(name)
  flash(`Deleted "${name}"`)
}
async function handleImport() {
  openMenu.value = null
  try {
    const text = await navigator.clipboard.readText()
    if (!text.trim()) return flash('Clipboard is empty')
    cardStore.importDeck(text)
    flash(`Imported ${cardStore.deckSize} cards`)
  } catch {
    flash('Could not read clipboard')
  }
}
function handleExport() {
  openMenu.value = null
  if (cardStore.deckSize === 0) return flash('Deck is empty')
  flash(copyToClipboard(cardStore.exportDeck()) ? 'Copied deck list' : 'Could not copy')
}

/* ---- deck readout ---- */
const deckCount = computed(() => cardStore.deck.filter(c => c.type !== 'leader').length)
const hasLeader = computed(() => cardStore.deck.some(c => c.type === 'leader'))
const deckComplete = computed(() => hasLeader.value && deckCount.value === 50)

const nextCurrency = computed(
  () => ({ USD: 'CAD', CAD: 'GBP', GBP: 'USD' } as const)[cardStore.currency]
)

/* ---- bling ---- */
const blingTitle = computed(() => {
  if (cardStore.blingLevel === 0) return 'Show alt-art printings — click to cycle'
  const n = cardStore.blingSwapCount
  if (n === 0) return 'No cards in this deck have a priced alt-art printing'
  return `${n} card${n === 1 ? '' : 's'} showing ${cardStore.blingLevel === 2 ? 'their most expensive' : 'a mid-priced'} printing`
})
</script>

<template>
  <header ref="headerRef" class="app-header">
    <!-- identity -->
    <div class="brand">
      <img src="/logo.png" alt="" class="brand-mark" width="30" height="30" />
      <span class="brand-name">OP DECK BUILDER</span>
    </div>

    <div class="divider"></div>

    <!-- deck name + saved decks -->
    <div class="deck-id" data-tour="name-group">
      <input
        v-model="cardStore.deckName"
        class="deck-name"
        type="text"
        placeholder="Untitled deck"
        aria-label="Deck name"
        spellcheck="false"
      />
      <div class="menu-anchor">
        <button class="icon-btn" title="Saved decks" :aria-expanded="openMenu === 'decks'" @click="toggleMenu('decks')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        <div v-if="openMenu === 'decks'" class="menu">
          <button class="menu-item" @click="handleNew">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
            New deck
          </button>
          <div v-if="cardStore.savedDecks.length" class="menu-sep"></div>
          <div v-if="cardStore.savedDecks.length" class="menu-scroll">
            <div v-for="d in cardStore.savedDecks" :key="d.name" class="deck-row">
              <button class="deck-row-main" @click="handleLoad(d.name)">
                <img v-if="d.leaderImage" :src="d.leaderImage" alt="" class="deck-leader" width="22" height="31" />
                <span v-else class="deck-leader placeholder"></span>
                <span class="deck-row-text">
                  <span class="deck-row-name">{{ d.name }}</span>
                  <span class="deck-row-sub">{{ d.leaderColors }} · {{ d.leaderName || 'No leader' }}</span>
                </span>
              </button>
              <button class="deck-row-del" title="Delete" @click.stop="handleDelete(d.name)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
          <p v-else class="menu-empty">No saved decks yet</p>
        </div>
      </div>
    </div>

    <!-- file actions -->
    <div class="menu-anchor" data-tour="import-export">
      <button class="ghost-btn" :aria-expanded="openMenu === 'file'" @click="toggleMenu('file')">
        Deck
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      <div v-if="openMenu === 'file'" class="menu menu-narrow">
        <button class="menu-item" @click="handleImport">Import from clipboard</button>
        <button class="menu-item" @click="handleExport">Export for sim</button>
      </div>
    </div>

    <button class="ghost-btn" @click="handleSave">Save</button>

    <span v-if="status" class="status">{{ status }}</span>

    <div class="spacer"></div>

    <!-- readouts -->
    <div class="count" :class="{ complete: deckComplete }" :title="hasLeader ? 'Leader set' : 'No leader yet'">
      <span class="count-num">{{ deckCount }}</span><span class="count-max">/50</span>
      <span class="count-leader" :class="{ on: hasLeader }" title="Leader">L</span>
    </div>

    <button
      class="pill price"
      :class="{ muted: cardStore.deckSize === 0 }"
      :title="deckTotal.unpricedNote.value
        ? `${deckTotal.unpricedNote.value} — click for ${nextCurrency}`
        : `Market total — click for ${nextCurrency}`"
      @click="cardStore.toggleCurrency"
    >
      {{ deckTotal.formatted.value }}
      <span v-if="deckTotal.unpriced.value" class="price-warn">*</span>
    </button>

    <!-- bling: Bling -> Blingy -> Blingest -->
    <button
      class="pill bling"
      :class="[`level-${cardStore.blingLevel}`, { busy: cardStore.blingLoading }]"
      :disabled="cardStore.deckSize === 0"
      :title="blingTitle"
      @click="cardStore.cycleBling()"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
        <path d="M12 2 15 9l7 3-7 3-3 7-3-7-7-3 7-3z" />
      </svg>
      {{ cardStore.blingLabel }}
      <span v-if="cardStore.blingLevel > 0 && cardStore.blingSwapCount" class="bling-count">{{ cardStore.blingSwapCount }}</span>
    </button>

    <div class="divider"></div>

    <button class="ghost-btn" :disabled="cardStore.deckSize === 0" @click="emit('share')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      Share
    </button>

    <button class="ghost-btn" @click="emit('proxy')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 6 2 18 2 18 9" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
      </svg>
      Proxy
    </button>

    <button class="icon-btn round" title="Take the tour" @click="emit('tour')">?</button>

    <!-- overwrite confirm -->
    <div v-if="showOverwrite" class="confirm">
      <p>Overwrite “<strong>{{ cardStore.deckName.trim() }}</strong>”?</p>
      <div class="confirm-actions">
        <button class="ghost-btn" @click="showOverwrite = false">Cancel</button>
        <button class="ghost-btn danger" @click="confirmSave">Overwrite</button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  grid-area: header;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  height: 52px;
  padding: 0 var(--space-5);
  background: var(--surface-raised);
  border-bottom: 1px solid var(--border-subtle);
  position: relative;
  z-index: var(--z-sticky);
}

/* ---- brand ---- */
.brand { display: flex; align-items: center; gap: var(--space-3); flex-shrink: 0; }
.brand-mark { width: 30px; height: 30px; object-fit: contain; }
.brand-name {
  font-family: var(--font-display);
  font-size: var(--text-base);
  letter-spacing: 0.04em;
  color: var(--text-strong);
  white-space: nowrap;
}

.divider { width: 1px; height: 22px; background: var(--border-default); flex-shrink: 0; }
.spacer { flex: 1; }

/* ---- deck name ---- */
.deck-id {
  display: flex;
  align-items: center;
  height: 32px;
  padding-right: var(--space-1);
  background: var(--surface-canvas);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  transition: border-color var(--dur-fast) var(--ease-out);
}
.deck-id:focus-within { border-color: var(--accent); }
.deck-name {
  width: 168px;
  padding: 0 var(--space-4);
  background: none;
  border: none;
  outline: none;
  color: var(--text-strong);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}
.deck-name::placeholder { color: var(--text-subtle); font-weight: var(--weight-normal); }

/* ---- buttons ---- */
.ghost-btn {
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
              color var(--dur-fast) var(--ease-out),
              border-color var(--dur-fast) var(--ease-out);
}
.ghost-btn:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--text-strong);
  border-color: var(--border-strong);
}
.ghost-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ghost-btn.danger { color: var(--danger); border-color: var(--danger); }

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  color: var(--text-subtle);
  transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
}
.icon-btn:hover { background: var(--surface-hover); color: var(--text-strong); }
.icon-btn.round {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-pill);
  font-size: var(--text-2xs);
  font-weight: var(--weight-bold);
}

/* ---- readouts ---- */
.count {
  display: flex;
  align-items: baseline;
  gap: 1px;
  padding: 0 var(--space-4);
  height: 32px;
  line-height: 32px;
  background: var(--surface-raised-2);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-variant-numeric: tabular-nums;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--text-default);
}
.count.complete { border-color: var(--positive); color: var(--positive); }
.count-max { color: var(--text-subtle); font-size: var(--text-2xs); font-weight: var(--weight-medium); }
.count-leader {
  margin-left: var(--space-3);
  align-self: center;
  width: 15px; height: 15px;
  line-height: 15px;
  text-align: center;
  border-radius: var(--radius-xs);
  background: var(--surface-hover);
  color: var(--text-subtle);
  font-size: 10px;
  font-weight: var(--weight-bold);
}
.count-leader.on { background: var(--accent); color: var(--on-accent); }

.pill {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: 32px;
  padding: 0 var(--space-4);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--surface-raised-2);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  white-space: nowrap;
  transition: background var(--dur-fast) var(--ease-out),
              color var(--dur-fast) var(--ease-out),
              border-color var(--dur-fast) var(--ease-out);
}
.price { color: var(--positive); font-variant-numeric: tabular-nums; }
.price:hover { border-color: var(--positive); background: var(--positive-quiet); }
.price.muted { color: var(--text-subtle); }
.price-warn { color: var(--warning); }

/* Bling escalates visually with the tier so the state is readable at a glance. */
.bling { color: var(--text-muted); }
.bling:hover:not(:disabled) { color: var(--text-strong); border-color: var(--border-strong); }
.bling:disabled { opacity: 0.4; cursor: not-allowed; }
.bling.level-1 {
  --bling-badge: var(--info);
  color: var(--info);
  border-color: var(--info);
  background: color-mix(in srgb, var(--info) 14%, transparent);
}
.bling.level-2 {
  --bling-badge: var(--warning);
  color: var(--warning);
  border-color: var(--warning);
  background: var(--warning-quiet);
  box-shadow: 0 0 12px color-mix(in srgb, var(--warning) 22%, transparent);
}
.bling.busy { opacity: 0.65; }
.bling-count {
  min-width: 15px;
  padding: 0 4px;
  border-radius: var(--radius-pill);
  /* NOT `background: currentColor` — currentColor resolves against THIS
     element's own `color`, which is the dark chip text, so the badge rendered
     as a black box. Inherit the tier colour through a custom property instead. */
  background: var(--bling-badge, var(--text-muted));
  color: var(--surface-canvas);
  font-size: 10px;
  font-weight: var(--weight-bold);
  text-align: center;
  line-height: 15px;
}

.status {
  color: var(--text-muted);
  font-size: var(--text-2xs);
  white-space: nowrap;
  animation: fade-in var(--dur-base) var(--ease-out);
}
@keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }

/* ---- menus ---- */
.menu-anchor { position: relative; flex-shrink: 0; }
.menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: var(--z-popover);
  min-width: 250px;
  padding: var(--space-3);
  background: var(--surface-overlay);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  animation: pop-in var(--dur-fast) var(--ease-out);
}
.menu-narrow { min-width: 190px; }
@keyframes pop-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: none; }
}
.menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: var(--text-xs);
  text-align: left;
  transition: background var(--dur-instant) var(--ease-out), color var(--dur-instant) var(--ease-out);
}
.menu-item:hover { background: var(--surface-hover); color: var(--text-strong); }
.menu-sep { height: 1px; margin: var(--space-3) 0; background: var(--border-default); }
.menu-scroll { max-height: 320px; overflow-y: auto; }
.menu-empty { padding: var(--space-4); color: var(--text-subtle); font-size: var(--text-xs); text-align: center; }

.deck-row { display: flex; align-items: center; gap: var(--space-1); }
.deck-row-main {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex: 1;
  min-width: 0;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  text-align: left;
  transition: background var(--dur-instant) var(--ease-out);
}
.deck-row-main:hover { background: var(--surface-hover); }
.deck-leader {
  width: 22px;
  height: 31px;
  object-fit: cover;
  border-radius: var(--radius-xs);
  flex-shrink: 0;
}
.deck-leader.placeholder { background: var(--surface-hover); }
.deck-row-text { display: flex; flex-direction: column; min-width: 0; }
.deck-row-name {
  color: var(--text-default);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.deck-row-sub { color: var(--text-subtle); font-size: var(--text-2xs); }
.deck-row-del {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px; height: 22px;
  border-radius: var(--radius-sm);
  color: var(--text-subtle);
  opacity: 0;
  transition: opacity var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
}
.deck-row:hover .deck-row-del { opacity: 1; }
.deck-row-del:hover { color: var(--danger); background: var(--surface-hover); }

/* ---- confirm ---- */
.confirm {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-modal);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
  background: var(--surface-overlay);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  font-size: var(--text-sm);
}
.confirm-actions { display: flex; gap: var(--space-3); justify-content: flex-end; }
</style>
