<script setup lang="ts">
import { useCardStore } from '../stores/cardStore'

const cardStore = useCardStore()

const colors = ['red', 'blue', 'green', 'purple', 'black', 'yellow']
const types = ['leader', 'character', 'event', 'stage']
const rarities = [
  { value: 'sr', label: 'SR' },
  { value: 'sec', label: 'SEC' },
  { value: 'l', label: 'L' },
  { value: 'r', label: 'R' },
  { value: 'uc', label: 'UC' },
  { value: 'c', label: 'C' },
  { value: 'tr', label: 'TR' },
  { value: 'sp card', label: 'SP' },
  { value: 'p', label: 'P' },
]
</script>

<template>
  <div class="filter-bar">
    <!-- Color buttons -->
    <span class="filter-label">Color</span>
    <div class="btn-grid">
      <button
        v-for="color in colors"
        :key="color"
        :class="['filter-btn', color, { active: cardStore.selectedColors.includes(color) }]"
        @click="cardStore.toggleColor(color)"
      >
        {{ color }}
      </button>
    </div>

    <!-- Type buttons -->
    <span class="filter-label">Type</span>
    <div class="btn-row">
      <button
        v-for="t in types"
        :key="t"
        :class="['filter-btn', { active: cardStore.selectedTypes.includes(t) }]"
        @click="cardStore.toggleType(t)"
      >
        {{ t }}
      </button>
    </div>

    <!-- Rarity buttons -->
    <span class="filter-label">Rarity</span>
    <div class="btn-row">
      <button
        v-for="r in rarities"
        :key="r.value"
        :class="['filter-btn', { active: cardStore.selectedRarities.includes(r.value) }]"
        @click="cardStore.toggleRarity(r.value)"
      >
        {{ r.label }}
      </button>
    </div>

    <!-- Counter buttons -->
    <span class="filter-label">Counter</span>
    <div class="btn-row">
      <button
        :class="['filter-btn', { active: cardStore.selectedCounters.includes(1000) }]"
        @click="cardStore.toggleCounter(1000)"
      >
        1K
      </button>
      <button
        :class="['filter-btn', { active: cardStore.selectedCounters.includes(2000) }]"
        @click="cardStore.toggleCounter(2000)"
      >
        2K
      </button>
    </div>

    <!-- Keyword buttons -->
    <span class="filter-label">Keyword</span>
    <div class="btn-row">
      <button
        :class="['filter-btn', { active: cardStore.selectedKeywords.includes('rush') }]"
        @click="cardStore.toggleKeyword('rush')"
      >
        Rush
      </button>
      <button
        :class="['filter-btn', { active: cardStore.selectedKeywords.includes('blocker') }]"
        @click="cardStore.toggleKeyword('blocker')"
      >
        Blocker
      </button>
      <button
        :class="['filter-btn', { active: cardStore.selectedKeywords.includes('banish') }]"
        @click="cardStore.toggleKeyword('banish')"
      >
        Banish
      </button>
    </div>
    <div class="btn-row">
      <button
        :class="['filter-btn', { active: cardStore.selectedKeywords.includes('double attack') }]"
        @click="cardStore.toggleKeyword('double attack')"
      >
        Double Attack
      </button>
      <button
        :class="['filter-btn', { active: cardStore.selectedKeywords.includes('searcher') }]"
        @click="cardStore.toggleKeyword('searcher')"
      >
        Searcher
      </button>
      <button
        :class="['filter-btn', { active: cardStore.selectedKeywords.includes('on k.o.') }]"
        @click="cardStore.toggleKeyword('on k.o.')"
      >
        On KO
      </button>
    </div>

    <!-- Sort by cost -->
    <span class="filter-label">Sort by Cost</span>
    <div class="btn-row">
      <button
        :class="['filter-btn', { active: cardStore.costSortDirection === 'desc' }]"
        @click="cardStore.costSortDirection = cardStore.costSortDirection === 'desc' ? '' : 'desc'"
      >
        High to Low
      </button>
      <button
        :class="['filter-btn', { active: cardStore.costSortDirection === 'asc' }]"
        @click="cardStore.costSortDirection = cardStore.costSortDirection === 'asc' ? '' : 'asc'"
      >
        Low to High
      </button>
    </div>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-label {
  color: var(--text-secondary);
  font-size: 0.75rem;
  text-transform: uppercase;
  font-weight: bold;
  margin-top: 4px;
}

/* 3-column grid for color buttons */
.btn-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 4px;
}

/* Flex row for type, rarity, options */
.btn-row {
  display: flex;
  gap: 4px;
}

.btn-row .filter-btn {
  flex: 1;
}

.filter-btn {
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.75rem;
  text-transform: capitalize;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.filter-btn.active {
  border-color: var(--accent);
  background-color: var(--accent);
  color: white;
}

/* Color-specific active styles */
.filter-btn.active.red    { background-color: #c62828; color: white; border-color: #c62828; }
.filter-btn.active.blue   { background-color: #1565c0; color: white; border-color: #1565c0; }
.filter-btn.active.green  { background-color: #2e7d32; color: white; border-color: #2e7d32; }
.filter-btn.active.purple { background-color: #6a1b9a; color: white; border-color: #6a1b9a; }
.filter-btn.active.black  { background-color: #444;    color: white; border-color: #666; }
.filter-btn.active.yellow { background-color: #f9a825; color: black; border-color: #f9a825; }
</style>
