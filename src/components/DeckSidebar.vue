<script setup lang="ts">
import { ref } from 'vue'
import { useCardStore } from '../stores/cardStore'

const cardStore = useCardStore()
const statusMessage = ref('')

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

    <!-- Deck name input -->
    <div class="control-group">
      <input
        type="text"
        placeholder="Deck name..."
        class="deck-name-input"
      />
      <div class="btn-row">
        <button class="sidebar-btn">Save</button>
        <button class="sidebar-btn">Load</button>
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
</style>
