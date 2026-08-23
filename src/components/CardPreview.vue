<script setup lang="ts">
/**
 * Floating card preview.
 *
 * Previously the preview owned a permanent slab of the left sidebar — 31% of the
 * screen sitting empty and reading "Hover a card to preview" until you moved the
 * mouse. Here it's a fixed overlay that only exists while a card is selected, so
 * the space goes to cards instead.
 */
import { computed, ref, watch } from 'vue'
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

/** Keywords present in the card's ability text. */
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
    <aside v-if="card" class="preview" aria-live="polite">
      <img
        :src="card.images.large"
        :alt="card.name"
        class="preview-img"
        width="600"
        height="838"
        decoding="async"
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
          >
            <span v-if="priceText" class="price">{{ priceText }}</span>
            <span v-else class="price muted">—</span>
          </a>
        </div>

        <div class="meta">
          <button class="id" :title="`Copy ${card.id}`" @click="copyId">
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
  left: var(--space-5);
  bottom: var(--space-5);
  z-index: var(--z-float);
  width: 300px;
  max-height: calc(100vh - 100px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--surface-overlay);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  /* The preview is informational, never a click target — let the pointer
     through so it can't block a card the user is reaching for. */
  pointer-events: none;
}
/* ...except the two things that ARE interactive. */
.preview .id,
.preview .tcg { pointer-events: auto; }

.preview-img {
  width: 100%;
  height: auto;
  aspect-ratio: var(--card-aspect);
  object-fit: cover;
  background: var(--surface-sunken);
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
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--text-strong);
  line-height: var(--leading-tight);
}
.tcg { text-decoration: none; }
.price {
  color: var(--positive);
  font-size: var(--text-sm);
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
  font-size: var(--text-xs);
}
.stats b {
  color: var(--text-strong);
  font-variant-numeric: tabular-nums;
  font-weight: var(--weight-semibold);
}

.family { color: var(--text-subtle); font-size: var(--text-2xs); font-style: italic; }

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
  font-size: var(--text-xs);
  line-height: var(--leading-relaxed);
  white-space: pre-line;
}

/* Fast and subtle — the preview follows the pointer around, so anything
   slower reads as lag rather than polish. */
.preview-enter-active { transition: opacity var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
.preview-leave-active { transition: opacity var(--dur-instant) var(--ease-out); }
.preview-enter-from { opacity: 0; transform: translateY(6px); }
.preview-leave-to { opacity: 0; }
</style>
