<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { toPng } from 'html-to-image'
import { useCardStore } from '../stores/cardStore'
import { useBreakpoint } from '../composables/useBreakpoint'

const { isMobile } = useBreakpoint()

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const cardStore = useCardStore()
const sheetRef = ref<HTMLDivElement | null>(null)
const status = ref('')
const isExporting = ref(false)

const colorOrder = ['red', 'blue', 'green', 'purple', 'black', 'yellow']
const typeOrder: Record<string, number> = { leader: 0, character: 1, event: 2, stage: 3 }

/** Cards grouped + sorted same as DeckDisplay (leader → char → event → stage) */
const groupedDeck = computed(() => {
  const groups = new Map<string, { card: typeof cardStore.deck[0]; count: number }>()
  for (const card of cardStore.deck) {
    const existing = groups.get(card.id)
    if (existing) existing.count++
    else groups.set(card.id, { card, count: 1 })
  }
  return Array.from(groups.values()).sort((a, b) => {
    const aType = typeOrder[a.card.type] ?? 9
    const bType = typeOrder[b.card.type] ?? 9
    if (aType !== bType) return aType - bType
    const aParts = a.card.color.split('/')
    const bParts = b.card.color.split('/')
    const aPrimary = colorOrder.indexOf(aParts[0] ?? '')
    const bPrimary = colorOrder.indexOf(bParts[0] ?? '')
    if (aPrimary !== bPrimary) return aPrimary - bPrimary
    const aSecondary = aParts[1] ? colorOrder.indexOf(aParts[1]) : -1
    const bSecondary = bParts[1] ? colorOrder.indexOf(bParts[1]) : -1
    if (aSecondary !== bSecondary) return aSecondary - bSecondary
    return a.card.cost - b.card.cost
  })
})

const leader = computed(() => cardStore.deck.find(c => c.type === 'leader') ?? null)
const nonLeaderGroups = computed(() => groupedDeck.value.filter(g => g.card.type !== 'leader'))

/** Cost curve data for the bar chart (only non-leader cards, only costs that exist) */
const costCurve = computed(() => {
  const curve: Record<number, number> = {}
  for (const g of nonLeaderGroups.value) {
    curve[g.card.cost] = (curve[g.card.cost] ?? 0) + g.count
  }
  return Object.entries(curve)
    .map(([cost, count]) => ({ cost: Number(cost), count }))
    .sort((a, b) => a.cost - b.cost)
})

const maxCost = computed(() => Math.max(1, ...costCurve.value.map(c => c.count)))

/** Type breakdown */
const typeStats = computed(() => {
  let chars = 0
  let events = 0
  let stages = 0
  for (const g of nonLeaderGroups.value) {
    if (g.card.type === 'character') chars += g.count
    else if (g.card.type === 'event') events += g.count
    else if (g.card.type === 'stage') stages += g.count
  }
  return { chars, events, stages }
})

/** Counter breakdown */
const counterStats = computed(() => {
  let c0 = 0, c1k = 0, c2k = 0
  for (const g of nonLeaderGroups.value) {
    if (g.card.counter === 1000) c1k += g.count
    else if (g.card.counter === 2000) c2k += g.count
    else c0 += g.count
  }
  return { c0, c1k, c2k }
})

const deckTitle = computed(() => cardStore.deckName.trim() || 'Untitled Deck')

async function generatePng(): Promise<string | null> {
  if (!sheetRef.value) return null
  isExporting.value = true
  await nextTick()
  try {
    const dataUrl = await toPng(sheetRef.value, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: '#0d0d0d',
    })
    return dataUrl
  } catch (err) {
    console.error(err)
    return null
  } finally {
    isExporting.value = false
  }
}

async function handleDownload() {
  status.value = 'Generating image...'
  const dataUrl = await generatePng()
  if (!dataUrl) {
    status.value = 'Failed to generate image'
    return
  }
  const filename = `${deckTitle.value.replace(/[^a-z0-9]+/gi, '-')}.png`

  // On mobile (esp. iOS), use Web Share API so the OS share sheet opens.
  // From there the user can pick "Save Image" → Photos / Camera Roll.
  // Fallback to direct download on desktop or browsers without share support.
  if (isMobile.value && navigator.share) {
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], filename, { type: 'image/png' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: deckTitle.value,
          text: `${deckTitle.value} — built with OP Deck Builder`,
        })
        status.value = 'Shared!'
        setTimeout(() => { status.value = '' }, 2000)
        return
      }
    } catch (err: unknown) {
      // User-canceled the share sheet — that's fine, just clear status
      if ((err as Error)?.name === 'AbortError') {
        status.value = ''
        return
      }
      // Real failure → fall through to download fallback
    }
  }

  // Fallback: classic download anchor
  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  link.click()
  status.value = 'Downloaded!'
  setTimeout(() => { status.value = '' }, 2000)
}

async function handleCopy() {
  status.value = 'Generating image...'
  const dataUrl = await generatePng()
  if (!dataUrl) {
    status.value = 'Failed to generate image'
    return
  }
  try {
    const blob = await (await fetch(dataUrl)).blob()
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ])
    status.value = 'Copied to clipboard!'
  } catch {
    status.value = 'Clipboard write failed'
  }
  setTimeout(() => { status.value = '' }, 2000)
}

function handleBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}
</script>

<template>
  <Teleport to="body">
    <!-- Mobile: compact action dialog. Sheet still rendered off-screen so PNG capture works. -->
    <div v-if="open && isMobile" class="m-backdrop" @click="handleBackdropClick">
      <div class="m-dialog">
        <div class="m-dialog-header">
          <h3>Share Deck</h3>
          <button class="m-close" @click="emit('close')">×</button>
        </div>
        <p class="m-dialog-sub">Generate an image of "{{ deckTitle }}"</p>
        <div v-if="status" class="m-status">{{ status }}</div>
        <div class="m-actions">
          <button class="m-action" @click="handleCopy" :disabled="isExporting">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            <span>Copy to Clipboard</span>
          </button>
          <button class="m-action primary" @click="handleDownload" :disabled="isExporting">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            <span>Save / Share Image</span>
          </button>
        </div>

        <!-- Hidden sheet kept in DOM for html-to-image to capture -->
        <div class="hidden-sheet">
          <div ref="sheetRef" class="share-sheet">
            <div class="sheet-header">
              <div class="leader-thumb">
                <img v-if="leader" :src="leader.images.small" :alt="leader.name" />
              </div>
              <h1 class="sheet-title">{{ deckTitle }}</h1>
              <div class="sheet-brand">
                <img src="/logo.png" alt="logo" />
              </div>
            </div>
            <div class="sheet-cards">
              <div v-for="entry in nonLeaderGroups" :key="entry.card.id" class="sheet-card">
                <div class="card-img-wrap">
                  <img :src="entry.card.images.small" :alt="entry.card.name" />
                  <span class="count-badge">×{{ entry.count }}</span>
                </div>
                <div class="card-id">{{ entry.card.id }}</div>
              </div>
            </div>
            <div class="sheet-stats">
              <div class="stat-block">
                <div class="stat-label cost">Cost</div>
                <div class="cost-bars">
                  <div v-for="entry in costCurve" :key="entry.cost" class="cost-bar-col">
                    <div class="cost-bar" :style="{ height: `${(entry.count / maxCost) * 60}px` }">
                      <span class="cost-bar-num">{{ entry.count }}</span>
                    </div>
                    <div class="cost-bar-cost">{{ entry.cost }}</div>
                  </div>
                </div>
              </div>
              <div class="stat-block">
                <div class="stat-label type">Type</div>
                <div class="stat-row">
                  <div class="stat-cell"><div class="stat-num">{{ typeStats.chars }}</div><div class="stat-sub">CHAR</div></div>
                  <div class="stat-cell"><div class="stat-num">{{ typeStats.events }}</div><div class="stat-sub">EVENT</div></div>
                  <div v-if="typeStats.stages > 0" class="stat-cell"><div class="stat-num">{{ typeStats.stages }}</div><div class="stat-sub">STAGE</div></div>
                </div>
              </div>
              <div class="stat-block">
                <div class="stat-label counter">Counter</div>
                <div class="stat-row">
                  <div class="stat-cell"><div class="stat-num">{{ counterStats.c0 }}</div><div class="stat-sub">0</div></div>
                  <div class="stat-cell"><div class="stat-num">{{ counterStats.c1k }}</div><div class="stat-sub">1000</div></div>
                  <div class="stat-cell"><div class="stat-num">{{ counterStats.c2k }}</div><div class="stat-sub">2000</div></div>
                </div>
              </div>
            </div>
            <div class="sheet-footer">created with OP Deck Builder</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Desktop: full preview modal -->
    <div v-else-if="open" class="modal-backdrop" @click="handleBackdropClick">
      <div class="modal-window">
        <div class="modal-header">
          <h2>Share Deck</h2>
          <div class="modal-actions">
            <button class="action-btn" @click="handleCopy" :disabled="isExporting">
              Copy Image
            </button>
            <button class="action-btn primary" @click="handleDownload" :disabled="isExporting">
              Download PNG
            </button>
            <button class="close-btn" @click="emit('close')">×</button>
          </div>
        </div>

        <div v-if="status" class="status-line">{{ status }}</div>

        <div class="modal-scroll">
          <!-- THE GENERATED SHEET -->
          <div ref="sheetRef" class="share-sheet">
            <!-- Header: leader + title -->
            <div class="sheet-header">
              <div class="leader-thumb">
                <img v-if="leader" :src="leader.images.small" :alt="leader.name" />
              </div>
              <h1 class="sheet-title">{{ deckTitle }}</h1>
              <div class="sheet-brand">
                <img src="/logo.png" alt="logo" />
              </div>
            </div>

            <!-- Card grid -->
            <div class="sheet-cards">
              <div
                v-for="entry in nonLeaderGroups"
                :key="entry.card.id"
                class="sheet-card"
              >
                <div class="card-img-wrap">
                  <img :src="entry.card.images.small" :alt="entry.card.name" />
                  <span class="count-badge">×{{ entry.count }}</span>
                </div>
                <div class="card-id">{{ entry.card.id }}</div>
              </div>
            </div>

            <!-- Stats footer -->
            <div class="sheet-stats">
              <!-- Cost curve -->
              <div class="stat-block">
                <div class="stat-label cost">Cost</div>
                <div class="cost-bars">
                  <div
                    v-for="entry in costCurve"
                    :key="entry.cost"
                    class="cost-bar-col"
                  >
                    <div class="cost-bar" :style="{ height: `${(entry.count / maxCost) * 60}px` }">
                      <span class="cost-bar-num">{{ entry.count }}</span>
                    </div>
                    <div class="cost-bar-cost">{{ entry.cost }}</div>
                  </div>
                </div>
              </div>

              <!-- Type -->
              <div class="stat-block">
                <div class="stat-label type">Type</div>
                <div class="stat-row">
                  <div class="stat-cell">
                    <div class="stat-num">{{ typeStats.chars }}</div>
                    <div class="stat-sub">CHAR</div>
                  </div>
                  <div class="stat-cell">
                    <div class="stat-num">{{ typeStats.events }}</div>
                    <div class="stat-sub">EVENT</div>
                  </div>
                  <div v-if="typeStats.stages > 0" class="stat-cell">
                    <div class="stat-num">{{ typeStats.stages }}</div>
                    <div class="stat-sub">STAGE</div>
                  </div>
                </div>
              </div>

              <!-- Counter -->
              <div class="stat-block">
                <div class="stat-label counter">Counter</div>
                <div class="stat-row">
                  <div class="stat-cell">
                    <div class="stat-num">{{ counterStats.c0 }}</div>
                    <div class="stat-sub">0</div>
                  </div>
                  <div class="stat-cell">
                    <div class="stat-num">{{ counterStats.c1k }}</div>
                    <div class="stat-sub">1000</div>
                  </div>
                  <div class="stat-cell">
                    <div class="stat-num">{{ counterStats.c2k }}</div>
                    <div class="stat-sub">2000</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="sheet-footer">created with OP Deck Builder</div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

/* ===== MOBILE COMPACT DIALOG ===== */
.m-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.m-dialog {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  width: 100%;
  max-width: 360px;
  padding: 18px 18px 16px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.6);
}

.m-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.m-dialog-header h3 {
  color: var(--text-primary);
  font-size: 1.1rem;
  margin: 0;
}

.m-close {
  width: 30px;
  height: 30px;
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 50%;
  color: var(--text-secondary);
  font-size: 1.2rem;
  line-height: 1;
  padding: 0;
  cursor: pointer;
}

.m-dialog-sub {
  color: var(--text-secondary);
  font-size: 0.82rem;
  margin: 4px 0 12px;
}

.m-status {
  text-align: center;
  padding: 8px;
  margin-bottom: 10px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  color: var(--accent);
  font-size: 0.85rem;
}

.m-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.m-action {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
}

.m-action:active {
  background: var(--bg-secondary);
}

.m-action.primary {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.m-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Hide the share sheet from view but keep it in DOM for capture */
.hidden-sheet {
  position: fixed;
  top: 0;
  left: -9999px;
  pointer-events: none;
}

.modal-window {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  width: 100%;
  max-width: 1000px;
  max-height: 95vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-tertiary);
}

.modal-header h2 {
  color: var(--text-primary);
  font-size: 1.1rem;
  margin: 0;
}

.modal-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.action-btn {
  padding: 7px 14px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 5px;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.15s ease;
}

.action-btn:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}

.action-btn.primary {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.action-btn.primary:hover {
  filter: brightness(1.15);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.close-btn {
  width: 30px;
  height: 30px;
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 50%;
  color: var(--text-secondary);
  font-size: 1.2rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 4px;
}

.close-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.status-line {
  text-align: center;
  padding: 6px;
  color: var(--accent);
  font-size: 0.85rem;
  background: var(--bg-tertiary);
}

.modal-scroll {
  overflow: auto;
  padding: 20px;
  background: #050505;
}

/* ===== THE SHARE SHEET (becomes the PNG) ===== */
.share-sheet {
  width: 920px;
  margin: 0 auto;
  background: #0d0d0d;
  border: 1px solid #222;
  border-radius: 8px;
  padding: 24px;
  font-family: var(--font-family);
  color: #e8e8e8;
}

.sheet-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #2a2a2a;
  margin-bottom: 18px;
}

.leader-thumb {
  width: 110px;
  height: 110px;
  border-radius: 6px;
  overflow: hidden;
  border: 2px solid var(--accent);
  background: #1a1a1a;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.leader-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
}

.sheet-title {
  flex: 1;
  text-align: center;
  font-family: 'Carbon', sans-serif;
  font-size: 2rem;
  color: #f0f0f0;
  margin: 0;
  letter-spacing: 1px;
}

.sheet-brand {
  width: 90px;
  height: 90px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sheet-brand img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0.85;
}

.sheet-cards {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 12px 10px;
  margin-bottom: 22px;
}

.sheet-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.card-img-wrap {
  position: relative;
  width: 100%;
}

.card-img-wrap img {
  width: 100%;
  display: block;
  border-radius: 4px;
  box-shadow: 1px 1px 3px rgba(0, 0, 0, 0.6);
}

.count-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  font-size: 0.7rem;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.card-id {
  font-size: 0.65rem;
  color: #999;
  font-family: monospace;
}

/* Stats panel */
.sheet-stats {
  display: grid;
  grid-template-columns: 2fr 1fr 1.2fr;
  gap: 16px;
  padding: 16px;
  background: #131313;
  border: 1px solid #222;
  border-radius: 6px;
}

.stat-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: bold;
  padding: 3px 10px;
  border-radius: 3px;
  align-self: flex-start;
}

.stat-label.cost    { background: #1c4138; color: #4dd0b2; }
.stat-label.type    { background: #4a1c1c; color: #f08080; }
.stat-label.counter { background: #1c2846; color: #7da7ff; }

.cost-bars {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 90px;
  padding: 0 4px;
}

.cost-bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 26px;
}

.cost-bar {
  width: 100%;
  background: linear-gradient(180deg, #2a8f7a, #1c4138);
  border-radius: 3px 3px 0 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 4px;
  min-height: 18px;
}

.cost-bar-num {
  color: #fff;
  font-size: 0.85rem;
  font-weight: bold;
}

.cost-bar-cost {
  color: #888;
  font-size: 0.75rem;
}

.stat-row {
  display: flex;
  gap: 8px;
}

.stat-cell {
  flex: 1;
  background: #1a1a1a;
  border-radius: 4px;
  padding: 10px 6px;
  text-align: center;
}

.stat-num {
  color: #fff;
  font-size: 1.3rem;
  font-weight: bold;
  line-height: 1;
}

.stat-sub {
  color: #888;
  font-size: 0.65rem;
  margin-top: 4px;
  letter-spacing: 0.05em;
}

.sheet-footer {
  text-align: center;
  margin-top: 14px;
  color: #555;
  font-size: 0.7rem;
}
</style>
