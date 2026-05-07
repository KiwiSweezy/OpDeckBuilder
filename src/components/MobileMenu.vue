<script setup lang="ts">
import { ref, watch } from 'vue'
import { useCardStore } from '../stores/cardStore'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'navigate', view: 'proxy'): void
  (e: 'share'): void
}>()

const cardStore = useCardStore()
const status = ref('')

// Inline confirmation states (only one at a time)
const showOverwriteConfirm = ref(false)
const showClearConfirm = ref(false)
const deleteConfirmName = ref<string | null>(null)

watch(() => props.open, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
  // Reset any open confirmations when the drawer toggles
  if (!open) {
    showOverwriteConfirm.value = false
    showClearConfirm.value = false
    deleteConfirmName.value = null
  }
})

function flash(msg: string) {
  status.value = msg
  setTimeout(() => { status.value = '' }, 1800)
}

function handleSave() {
  const name = cardStore.deckName.trim()
  if (!name) { flash('Enter a deck name first'); return }
  if (cardStore.deckSize === 0) { flash('Deck is empty'); return }
  // If deck name exists, show inline overwrite confirmation
  if (cardStore.hasSavedDeck(name)) {
    showOverwriteConfirm.value = true
    return
  }
  confirmSave()
}

function confirmSave() {
  showOverwriteConfirm.value = false
  flash(cardStore.saveDeck())
}

function handleNewDeck() {
  cardStore.deckName = ''
  cardStore.clearDeck()
  emit('close')
}

function handleLoad(name: string) {
  flash(cardStore.loadDeck(name))
  emit('close')
}

function askDelete(name: string, e: Event) {
  e.stopPropagation()
  deleteConfirmName.value = name
}

function confirmDelete() {
  if (!deleteConfirmName.value) return
  const name = deleteConfirmName.value
  cardStore.deleteDeck(name)
  deleteConfirmName.value = null
  flash(`Deleted "${name}"`)
}

async function handleImport() {
  try {
    const text = await navigator.clipboard.readText()
    if (!text.trim()) { flash('Clipboard empty'); return }
    cardStore.importDeck(text)
    flash(`Imported ${cardStore.deckSize} cards`)
    emit('close')
  } catch {
    flash('Could not read clipboard')
  }
}

function copyToClipboard(text: string): boolean {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(() => {})
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus(); ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch { return false }
}

function handleExport() {
  if (cardStore.deckSize === 0) { flash('Deck is empty'); return }
  flash(copyToClipboard(cardStore.exportDeck()) ? 'Copied!' : 'Copy failed')
}

function askClear() {
  if (cardStore.deckSize === 0) return
  showClearConfirm.value = true
}

function confirmClear() {
  cardStore.clearDeck()
  showClearConfirm.value = false
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="open" class="drawer-backdrop" @click.self="emit('close')">
        <aside class="drawer">
          <div class="drawer-header">
            <h2>Menu</h2>
            <button class="drawer-close" @click="emit('close')">×</button>
          </div>

          <!-- Status flash (only for short success messages now) -->
          <div v-if="status" class="drawer-status">{{ status }}</div>

          <!-- Deck name + Save + Clear -->
          <div class="drawer-section">
            <label class="section-label">Current Deck</label>
            <input
              v-model="cardStore.deckName"
              type="text"
              placeholder="Deck name..."
              class="drawer-input"
            />
            <button class="drawer-btn primary" @click="handleSave">
              Save Deck
            </button>

            <!-- Inline overwrite confirmation -->
            <div v-if="showOverwriteConfirm" class="inline-confirm">
              <p class="confirm-text">Overwrite "<strong>{{ cardStore.deckName.trim() }}</strong>"?</p>
              <div class="confirm-actions">
                <button class="confirm-btn yes" @click="confirmSave">Yes, overwrite</button>
                <button class="confirm-btn" @click="showOverwriteConfirm = false">Cancel</button>
              </div>
            </div>

            <button
              v-if="cardStore.deckSize > 0"
              class="drawer-btn danger"
              @click="askClear"
            >
              Clear Deck
            </button>

            <!-- Inline clear confirmation -->
            <div v-if="showClearConfirm" class="inline-confirm danger">
              <p class="confirm-text">Clear all <strong>{{ cardStore.deckSize }}</strong> cards from this deck?</p>
              <div class="confirm-actions">
                <button class="confirm-btn yes danger" @click="confirmClear">Yes, clear</button>
                <button class="confirm-btn" @click="showClearConfirm = false">Cancel</button>
              </div>
            </div>
          </div>

          <!-- Saved decks -->
          <div class="drawer-section">
            <label class="section-label">Saved Decks ({{ cardStore.savedDecks.length }})</label>
            <div class="saved-list">
              <template v-for="deck in cardStore.savedDecks" :key="deck.name">
                <div
                  v-if="deleteConfirmName !== deck.name"
                  class="saved-item"
                  @click="handleLoad(deck.name)"
                >
                  <img v-if="deck.leaderImage" :src="deck.leaderImage" class="saved-thumb" />
                  <div v-else class="saved-thumb-placeholder" />
                  <div class="saved-info">
                    <div class="saved-name">{{ deck.name }}</div>
                    <div v-if="deck.leaderName" class="saved-leader">{{ deck.leaderColors }} · {{ deck.leaderName }}</div>
                  </div>
                  <button class="saved-delete" @click="askDelete(deck.name, $event)">×</button>
                </div>
                <!-- Inline delete confirmation, replaces the row -->
                <div v-else class="inline-confirm danger saved-confirm">
                  <p class="confirm-text">Delete "<strong>{{ deck.name }}</strong>"?</p>
                  <div class="confirm-actions">
                    <button class="confirm-btn yes danger" @click="confirmDelete">Delete</button>
                    <button class="confirm-btn" @click="deleteConfirmName = null">Cancel</button>
                  </div>
                </div>
              </template>
              <div v-if="cardStore.savedDecks.length === 0" class="saved-empty">
                No saved decks yet
              </div>
            </div>
            <button class="drawer-btn" @click="handleNewDeck">
              + New Deck
            </button>
          </div>

          <!-- Actions -->
          <div class="drawer-section">
            <label class="section-label">Actions</label>
            <button class="drawer-btn" @click="handleImport">
              Import from Clipboard
            </button>
            <button class="drawer-btn" @click="handleExport">
              Export for Sim
            </button>
            <button class="drawer-btn" @click="emit('share'); emit('close')">
              Share Deck Image
            </button>
            <button class="drawer-btn" @click="emit('navigate', 'proxy'); emit('close')">
              Proxy Printer
            </button>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1400;
}

.drawer {
  position: absolute;
  top: 0;
  left: 0;
  width: 86%;
  max-width: 380px;
  height: 100vh;
  height: 100dvh;
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  box-shadow: 4px 0 16px rgba(0, 0, 0, 0.5);
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  position: sticky;
  top: 0;
  z-index: 1;
}

.drawer-header h2 {
  color: var(--text-primary);
  font-size: 1.1rem;
  margin: 0;
}

.drawer-close {
  width: 36px;
  height: 36px;
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 50%;
  color: var(--text-secondary);
  font-size: 1.4rem;
  line-height: 1;
  padding: 0;
  cursor: pointer;
}

.drawer-status {
  margin: 8px 16px 0;
  padding: 8px 12px;
  background: var(--accent);
  color: white;
  border-radius: 6px;
  font-size: 0.85rem;
  text-align: center;
}

.drawer-section {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  color: var(--text-secondary);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: bold;
}

.drawer-input {
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.9rem;
  outline: none;
}

.drawer-input:focus { border-color: var(--accent); }

.drawer-btn {
  padding: 12px 14px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.9rem;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.drawer-btn:active { background: var(--bg-secondary); }
.drawer-btn:hover { border-color: var(--accent); }

.drawer-btn.primary {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
  text-align: center;
  font-weight: 600;
}

.drawer-btn.danger {
  color: var(--accent);
  border-color: var(--accent);
  text-align: center;
  font-weight: 600;
}

.saved-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 220px;
  overflow-y: auto;
  background: var(--bg-tertiary);
  border-radius: 6px;
  padding: 4px;
}

.saved-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  background: var(--bg-secondary);
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.1s ease;
}

.saved-item:active { background: var(--bg-tertiary); }

.saved-thumb,
.saved-thumb-placeholder {
  width: 36px;
  height: 50px;
  object-fit: cover;
  border-radius: 3px;
  flex-shrink: 0;
}

.saved-thumb-placeholder { background: var(--bg-tertiary); }

.saved-info {
  flex: 1;
  min-width: 0;
}

.saved-name {
  color: var(--text-primary);
  font-size: 0.88rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.saved-leader {
  color: var(--text-secondary);
  font-size: 0.7rem;
}

.saved-delete {
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1.2rem;
  line-height: 1;
  padding: 0;
  cursor: pointer;
}

.saved-empty {
  padding: 12px;
  color: var(--text-secondary);
  font-size: 0.85rem;
  text-align: center;
}

/* Inline confirmation boxes — appears below the action that triggered it */
.inline-confirm {
  background: var(--bg-tertiary);
  border: 1px solid var(--accent);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  animation: confirm-in 0.18s ease-out;
}

.inline-confirm.saved-confirm {
  margin: 0;
}

.confirm-text {
  margin: 0;
  color: var(--text-primary);
  font-size: 0.85rem;
  line-height: 1.3;
}

.confirm-text strong {
  color: var(--accent);
  font-weight: 600;
}

.confirm-actions {
  display: flex;
  gap: 6px;
}

.confirm-btn {
  flex: 1;
  padding: 8px 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
}

.confirm-btn:active {
  background: var(--bg-tertiary);
}

.confirm-btn.yes {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.confirm-btn.yes.danger {
  background: var(--accent);
}

@keyframes confirm-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Drawer slide-in animation */
.drawer-enter-active,
.drawer-leave-active { transition: opacity 0.2s ease; }
.drawer-enter-active .drawer,
.drawer-leave-active .drawer { transition: transform 0.25s ease; }
.drawer-enter-from,
.drawer-leave-to { opacity: 0; }
.drawer-enter-from .drawer,
.drawer-leave-to .drawer { transform: translateX(-100%); }
</style>
