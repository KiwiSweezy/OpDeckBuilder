<script setup lang="ts">
import { ref } from 'vue'
import { useCardStore } from '../stores/cardStore'

const cardStore = useCardStore()
const statusMessage = ref('')
const showLoadDropdown = ref(false)
const showOverwriteConfirm = ref(false)

/** Save the current deck to localStorage (with overwrite check) */
function handleSave() {
  const name = cardStore.deckName.trim()
  if (!name || cardStore.deckSize === 0) {
    const msg = cardStore.saveDeck()
    statusMessage.value = msg
    clearStatus()
    return
  }
  if (cardStore.hasSavedDeck(name)) {
    showOverwriteConfirm.value = true
    return
  }
  confirmSave()
}

/** Actually perform the save */
function confirmSave() {
  showOverwriteConfirm.value = false
  const msg = cardStore.saveDeck()
  statusMessage.value = msg
  clearStatus()
}

/** Cancel overwrite */
function cancelOverwrite() {
  showOverwriteConfirm.value = false
}

/** Start a fresh deck (clear name + deck) */
function handleNewDeck() {
  cardStore.deckName = ''
  cardStore.clearDeck()
  showLoadDropdown.value = false
}

/** Load a deck from localStorage by name */
function handleLoad(name: string) {
  const msg = cardStore.loadDeck(name)
  statusMessage.value = msg
  showLoadDropdown.value = false
  clearStatus()
}

/** Delete a saved deck after confirmation */
function handleDelete(name: string) {
  cardStore.deleteDeck(name)
  statusMessage.value = `Deleted "${name}"`
  clearStatus()
}

/** Read the clipboard and parse the sim-format deck list */
async function handleImport() {
  try {
    const text = await navigator.clipboard.readText()
    if (!text.trim()) {
      statusMessage.value = 'Clipboard is empty'
      return
    }
    cardStore.importDeck(text)
    statusMessage.value = `Imported ${cardStore.deckSize} cards`
  } catch {
    statusMessage.value = 'Could not read clipboard'
  }
  clearStatus()
}

/** Export the deck to clipboard in sim format (e.g. "4xOP15-108") */
async function handleExport() {
  if (cardStore.deckSize === 0) {
    statusMessage.value = 'Deck is empty'
    clearStatus()
    return
  }
  try {
    const text = cardStore.exportDeck()
    await navigator.clipboard.writeText(text)
    statusMessage.value = 'Copied to clipboard!'
  } catch {
    statusMessage.value = 'Could not write to clipboard'
  }
  clearStatus()
}

/** Clear the status message after 2 seconds */
function clearStatus() {
  setTimeout(() => { statusMessage.value = '' }, 2000)
}
</script>

<template>
  <div class="deck-sidebar">
    <h1 class="app-title">OP Deck Builder</h1>

    <!-- Deck name + Save -->
    <div class="control-group name-group" data-tour="name-group">
      <div class="name-input-wrapper">
        <input
          v-model="cardStore.deckName"
          type="text"
          placeholder="Deck name..."
          class="deck-name-input"
        />
        <button
          class="dropdown-toggle"
          @click="showLoadDropdown = !showLoadDropdown"
        >
          {{ showLoadDropdown ? '▴' : '▾' }}
        </button>
      </div>

      <!-- Saved decks dropdown -->
      <div v-if="showLoadDropdown" class="load-dropdown">
        <div
          v-for="deck in cardStore.savedDecks"
          :key="deck.name"
          class="dropdown-item"
          @click="handleLoad(deck.name)"
        >
          <img
            v-if="deck.leaderImage"
            :src="deck.leaderImage"
            class="dropdown-thumb"
          />
          <div v-else class="dropdown-thumb-placeholder" />
          <div class="dropdown-info">
            <span class="dropdown-deck-name">{{ deck.name }}</span>
            <span v-if="deck.leaderName" class="dropdown-leader">
              {{ deck.leaderColors }}, {{ deck.leaderName }}
            </span>
          </div>
          <button class="dropdown-delete" @click.stop="handleDelete(deck.name)">
            &times;
          </button>
        </div>
        <div class="dropdown-item new-deck" @click="handleNewDeck">
          <div class="dropdown-thumb-placeholder new-deck-icon">+</div>
          <div class="dropdown-info">
            <span class="dropdown-deck-name">New Deck</span>
          </div>
        </div>
      </div>

      <button class="sidebar-btn full-width" @click="handleSave">Save Decklist</button>
    </div>

    <!-- Toast notification -->
    <Teleport to="body">
      <Transition name="toast">
        <div v-if="statusMessage" class="toast">{{ statusMessage }}</div>
      </Transition>
    </Teleport>

    <!-- Overwrite confirmation -->
    <div v-if="showOverwriteConfirm" class="overwrite-confirm">
      <span class="overwrite-text">Overwrite "{{ cardStore.deckName.trim() }}"?</span>
      <div class="overwrite-actions">
        <button class="sidebar-btn overwrite-btn confirm" @click="confirmSave">Yes</button>
        <button class="sidebar-btn overwrite-btn" @click="cancelOverwrite">Cancel</button>
      </div>
    </div>

    <!-- Import / Export -->
    <div class="control-group" data-tour="import-export">
      <button class="sidebar-btn full-width" @click="handleImport">
        Import from Clipboard
      </button>
      <button class="sidebar-btn full-width" @click="handleExport">
        Export for Sim
      </button>
    </div>

    <!-- Clear deck -->
    <div class="control-group">
      <button
        v-if="cardStore.deckSize > 0"
        class="sidebar-btn full-width clear-btn"
        @click="cardStore.clearDeck"
      >
        Clear Deck
      </button>
    </div>

  </div>
</template>

<style scoped>
.deck-sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.app-title {
  font-size: 1.3rem;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.name-input-wrapper {
  display: flex;
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
}

.name-input-wrapper:focus-within {
  border-color: var(--accent);
}

.deck-name-input {
  flex: 1;
  padding: 8px 10px;
  background: none;
  border: none;
  color: var(--text-primary);
  font-size: 0.85rem;
  outline: none;
}

.dropdown-toggle {
  padding: 0 10px;
  background: none;
  border: none;
  border-left: 1px solid var(--border-color);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.8rem;
}

.dropdown-toggle:hover {
  color: var(--text-primary);
}

.sidebar-btn {
  padding: 6px 12px;
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.8rem;
  flex: 1;
  transition: all 0.15s ease;
}

.sidebar-btn:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}

.full-width {
  width: 100%;
}

.clear-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* Load dropdown */
.load-dropdown {
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  max-height: 260px;
  overflow-y: auto;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color);
  transition: background-color 0.15s ease;
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item:hover {
  background-color: var(--bg-secondary);
}

.dropdown-thumb {
  width: 36px;
  height: 50px;
  object-fit: cover;
  border-radius: 3px;
  flex-shrink: 0;
}

.dropdown-thumb-placeholder {
  width: 36px;
  height: 50px;
  background-color: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  flex-shrink: 0;
}

.dropdown-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.dropdown-deck-name {
  color: var(--text-primary);
  font-size: 0.85rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-leader {
  color: var(--text-secondary);
  font-size: 0.7rem;
}

.dropdown-delete {
  padding: 4px 6px;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1.1rem;
  cursor: pointer;
  line-height: 1;
  flex-shrink: 0;
}

.dropdown-delete:hover {
  color: var(--accent);
}

.new-deck-icon {
  color: var(--text-secondary);
  font-size: 1.2rem;
  font-weight: 600;
  border: 1px dashed var(--border-color);
  background: none;
}

/* Overwrite confirmation */
.overwrite-confirm {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  background-color: var(--bg-tertiary);
  border: 1px solid var(--accent);
  border-radius: 6px;
}

.overwrite-text {
  color: var(--text-primary);
  font-size: 0.8rem;
  text-align: center;
}

.overwrite-actions {
  display: flex;
  gap: 6px;
}

.overwrite-btn {
  flex: 1;
}

.overwrite-btn.confirm {
  border-color: var(--accent);
  color: var(--accent);
}
</style>

<style>
/* Toast notification (unscoped — rendered via Teleport to body) */
.toast {
  position: fixed;
  top: 16px;
  right: 16px;
  padding: 16px 32px;
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 1.1rem;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(40px);
}
</style>
