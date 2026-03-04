<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'

const STORAGE_KEY = 'op-tour-completed'

interface TourStep {
  target: string | null   // data-tour attribute value, null = centered overlay
  title: string
  description: string
}

const steps: TourStep[] = [
  {
    target: null,
    title: 'Welcome to OP Deck Builder!',
    description: "Let's take a quick tour so you know where everything is.",
  },
  {
    target: 'name-group',
    title: 'Deck Name & Save',
    description: 'Name your deck and save it here. Use the dropdown to load or manage your saved decks.',
  },
  {
    target: 'import-export',
    title: 'Import & Export',
    description: 'Import a decklist from your clipboard, or export your deck in sim format to share it.',
  },
  {
    target: 'deck-area',
    title: 'Your Deck',
    description: 'Your deck appears here. Left-click a card to add another copy. Right-click to remove one. Shift + right-click removes the entire stack.',
  },
  {
    target: 'filters',
    title: 'Filters & Search',
    description: 'Use color, type, rarity, counter, and keyword filters to narrow down the card pool. You can also search by name, ID, family, or ability text.',
  },
  {
    target: 'card-pool',
    title: 'Card Pool',
    description: 'Click any card here to add it to your deck. Hover over a card to preview it on the left.',
  },
  {
    target: 'sidebar-preview',
    title: 'Card Preview & Stats',
    description: "Hover over any card to see its full art, stats, ability text, and keyword badges here. Your deck's cost curve and stats also appear below.",
  },
  {
    target: null,
    title: "You're all set!",
    description: 'Happy deckbuilding!',
  },
]

const isActive = ref(false)
const currentStep = ref(0)
const spotlightRect = ref({ top: 0, left: 0, width: 0, height: 0 })

const step = computed(() => steps[currentStep.value])
const isCentered = computed(() => step.value.target === null)
const stepLabel = computed(() => `${currentStep.value + 1} / ${steps.length}`)

// Tooltip position: centered on spotlight, below if room, above otherwise
const tooltipPosition = computed(() => {
  const r = spotlightRect.value
  if (r.width === 0) return {}

  const tooltipWidth = 340
  const gap = 12

  let left = r.left + r.width / 2 - tooltipWidth / 2
  left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16))

  const spaceBelow = window.innerHeight - (r.top + r.height)
  if (spaceBelow > 200) {
    return { top: r.top + r.height + gap + 'px', left: left + 'px' }
  } else {
    return { bottom: window.innerHeight - r.top + gap + 'px', left: left + 'px' }
  }
})

function start() {
  currentStep.value = 0
  isActive.value = true
  updateSpotlight()
}

function next() {
  if (currentStep.value < steps.length - 1) {
    currentStep.value++
    updateSpotlight()
  } else {
    finish()
  }
}

function back() {
  if (currentStep.value > 0) {
    currentStep.value--
    updateSpotlight()
  }
}

function skip() {
  finish()
}

function finish() {
  isActive.value = false
  localStorage.setItem(STORAGE_KEY, 'true')
}

function updateSpotlight() {
  nextTick(() => {
    const target = step.value.target
    if (!target) {
      spotlightRect.value = { top: 0, left: 0, width: 0, height: 0 }
      return
    }
    const el = document.querySelector(`[data-tour="${target}"]`)
    if (!el) {
      spotlightRect.value = { top: 0, left: 0, width: 0, height: 0 }
      return
    }
    const rect = el.getBoundingClientRect()
    const pad = 8
    spotlightRect.value = {
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    }
  })
}

function handleResize() {
  if (isActive.value) updateSpotlight()
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
  if (!localStorage.getItem(STORAGE_KEY)) {
    start()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})

defineExpose({ start })
</script>

<template>
  <Teleport to="body">
    <div v-if="isActive" class="tour-overlay" :class="isCentered ? 'no-spotlight' : 'has-spotlight'" @click.self="skip">
      <!-- Spotlight cutout (only for targeted steps) -->
      <div
        v-if="!isCentered"
        class="tour-spotlight"
        :style="{
          top: spotlightRect.top + 'px',
          left: spotlightRect.left + 'px',
          width: spotlightRect.width + 'px',
          height: spotlightRect.height + 'px',
        }"
      />

      <!-- Tooltip -->
      <div
        class="tour-tooltip"
        :class="{ centered: isCentered }"
        :style="isCentered ? {} : tooltipPosition"
      >
        <div class="tour-tooltip-header">
          <span class="tour-step-label">{{ stepLabel }}</span>
          <button class="tour-skip" @click="skip">Skip</button>
        </div>
        <h3 class="tour-title">{{ step.title }}</h3>
        <p class="tour-description">{{ step.description }}</p>
        <div class="tour-actions">
          <button v-if="currentStep > 0" class="tour-btn tour-btn-back" @click="back">Back</button>
          <button class="tour-btn tour-btn-next" @click="next">
            {{ currentStep === steps.length - 1 ? 'Finish' : 'Next' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style>
/* Unscoped — rendered via Teleport to body */
.tour-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
}

.tour-overlay.has-spotlight {
  background: transparent;
}

.tour-overlay.no-spotlight {
  background: rgba(0, 0, 0, 0.6);
}

.tour-spotlight {
  position: fixed;
  border-radius: 8px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6);
  z-index: 10000;
  pointer-events: none;
  transition: all 0.3s ease;
}

.tour-tooltip {
  position: fixed;
  width: 340px;
  background-color: #1a1a1a;
  border: 1px solid #333;
  border-radius: 10px;
  padding: 20px;
  z-index: 10001;
  transition: all 0.3s ease;
}

.tour-tooltip.centered {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.tour-tooltip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.tour-step-label {
  color: #999;
  font-size: 0.75rem;
  font-weight: bold;
  text-transform: uppercase;
}

.tour-skip {
  background: none;
  border: none;
  color: #999;
  font-size: 0.75rem;
  cursor: pointer;
  padding: 2px 6px;
}

.tour-skip:hover {
  color: #e8e8e8;
}

.tour-title {
  color: #e8e8e8;
  font-size: 1.1rem;
  margin: 0 0 8px 0;
}

.tour-description {
  color: #bbb;
  font-size: 0.85rem;
  line-height: 1.5;
  margin: 0 0 16px 0;
}

.tour-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.tour-btn {
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
  border: 1px solid #333;
  transition: all 0.15s ease;
}

.tour-btn-back {
  background: transparent;
  color: #999;
}

.tour-btn-back:hover {
  color: #e8e8e8;
  border-color: #555;
}

.tour-btn-next {
  background-color: #c62828;
  color: white;
  border-color: #c62828;
}

.tour-btn-next:hover {
  background-color: #d32f2f;
  border-color: #d32f2f;
}
</style>
