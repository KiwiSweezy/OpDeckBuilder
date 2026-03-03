<script setup lang="ts">
import { ref } from 'vue'
import { useCardStore } from '../stores/cardStore'

const cardStore = useCardStore()
const statusMessage = ref('')
const showLoadDropdown = ref(false)

/** Save the current deck to localStorage */
function handleSave() {
  const msg = cardStore.saveDeck()
  statusMessage.value = msg
  clearStatus()
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

    <!-- Deck name + Save/Load -->
    <div class="control-group">
      <input
        v-model="cardStore.deckName"
        type="text"
        placeholder="Deck name..."
        class="deck-name-input"
      />
      <div class="btn-row">
        <button class="sidebar-btn" @click="handleSave">Save</button>
        <button
          class="sidebar-btn"
          :class="{ active: showLoadDropdown }"
          @click="showLoadDropdown = !showLoadDropdown"
        >
          Load {{ showLoadDropdown ? '▴' : '▾' }}
        </button>
      </div>

      <!-- Saved decks dropdown -->
      <div v-if="showLoadDropdown" class="load-dropdown">
        <div v-if="cardStore.savedDeckNames.length === 0" class="dropdown-empty">
          No saved decks
        </div>
        <div
          v-for="name in cardStore.savedDeckNames"
          :key="name"
          class="dropdown-item"
        >
          <button class="dropdown-name" @click="handleLoad(name)">
            {{ name }}
          </button>
          <button class="dropdown-delete" @click.stop="handleDelete(name)">
            &times;
          </button>
        </div>
      </div>
    </div>

    <!-- Import / Export -->
    <div class="control-group">
      <button class="sidebar-btn full-width" @click="handleImport">
        Import from Clipboard
      </button>
      <button class="sidebar-btn full-width" @click="handleExport">
        Export to Clipboard
      </button>
    </div>

    <!-- Status message -->
    <span v-if="statusMessage" class="status-message">{{ statusMessage }}</span>

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

.deck-name-input {
  width: 100%;
  padding: 8px 10px;
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 0.85rem;
  outline: none;
}

.deck-name-input:focus {
  border-color: var(--accent);
}

.btn-row {
  display: flex;
  gap: 6px;
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

.sidebar-btn.active {
  border-color: var(--accent);
  color: var(--accent);
}

.full-width {
  width: 100%;
}

.clear-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.status-message {
  color: var(--accent);
  font-size: 0.8rem;
  text-align: center;
}

/* Load dropdown */
.load-dropdown {
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.dropdown-empty {
  padding: 8px 10px;
  color: var(--text-secondary);
  font-size: 0.8rem;
  text-align: center;
}

.dropdown-item {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-name {
  flex: 1;
  padding: 8px 10px;
  background: none;
  border: none;
  color: var(--text-primary);
  font-size: 0.8rem;
  cursor: pointer;
  text-align: left;
}

.dropdown-name:hover {
  background-color: var(--bg-secondary);
  color: var(--accent);
}

.dropdown-delete {
  padding: 4px 10px;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1rem;
  cursor: pointer;
  line-height: 1;
}

.dropdown-delete:hover {
  color: var(--accent);
}
</style>
