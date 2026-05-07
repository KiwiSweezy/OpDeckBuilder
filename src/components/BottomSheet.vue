<script setup lang="ts">
import { watch } from 'vue'

const props = defineProps<{
  open: boolean
  title?: string
}>()
const emit = defineEmits<{ (e: 'close'): void }>()

// Lock body scroll while sheet is open
watch(() => props.open, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

function handleBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="sheet-backdrop" @click="handleBackdropClick">
        <div class="sheet-window" @click.stop>
          <div class="sheet-handle"></div>
          <div v-if="title" class="sheet-header">
            <h3>{{ title }}</h3>
            <button class="sheet-close" @click="emit('close')">×</button>
          </div>
          <div class="sheet-content">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1500;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet-window {
  width: 100%;
  max-height: 88vh;
  max-height: 88dvh;
  background: var(--bg-secondary);
  border-radius: 16px 16px 0 0;
  padding-bottom: env(safe-area-inset-bottom);
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sheet-handle {
  width: 36px;
  height: 4px;
  background: var(--text-secondary);
  border-radius: 2px;
  margin: 8px auto 4px;
  opacity: 0.5;
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px 12px;
  border-bottom: 1px solid var(--border-color);
}

.sheet-header h3 {
  color: var(--text-primary);
  font-size: 1rem;
  margin: 0;
}

.sheet-close {
  width: 32px;
  height: 32px;
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 50%;
  color: var(--text-secondary);
  font-size: 1.2rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  line-height: 1;
}

.sheet-content {
  overflow-y: auto;
  padding: 12px 16px 24px;
}

/* Slide-up animation */
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.25s ease;
}
.sheet-enter-active .sheet-window,
.sheet-leave-active .sheet-window {
  transition: transform 0.25s ease;
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from .sheet-window,
.sheet-leave-to .sheet-window {
  transform: translateY(100%);
}
</style>
