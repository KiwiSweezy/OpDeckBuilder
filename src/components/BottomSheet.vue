<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  title?: string
}>()
const emit = defineEmits<{ (e: 'close'): void }>()

// Lock body scroll while sheet is open
watch(() => props.open, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
  if (!open) dragOffset.value = 0
})

function handleBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}

/* ===== Drag-to-dismiss =====
 * Track touch/mouse on the drag handle area. Translate the sheet down by
 * the drag delta. If user releases past DISMISS_THRESHOLD px, emit close;
 * otherwise spring back to 0. Only downward drags are honored. */
const DISMISS_THRESHOLD = 100
const dragOffset = ref(0)
const isDragging = ref(false)
let startY = 0

function getY(e: TouchEvent | MouseEvent): number {
  return 'touches' in e ? e.touches[0]?.clientY ?? 0 : e.clientY
}

function onDragStart(e: TouchEvent | MouseEvent) {
  isDragging.value = true
  startY = getY(e)
  dragOffset.value = 0
  window.addEventListener('touchmove', onDragMove, { passive: false })
  window.addEventListener('touchend', onDragEnd)
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', onDragEnd)
}

function onDragMove(e: TouchEvent | MouseEvent) {
  if (!isDragging.value) return
  const delta = getY(e) - startY
  // Only allow downward drag (positive delta)
  dragOffset.value = Math.max(0, delta)
  if ('touches' in e) e.preventDefault()
}

function onDragEnd() {
  if (!isDragging.value) return
  isDragging.value = false
  window.removeEventListener('touchmove', onDragMove)
  window.removeEventListener('touchend', onDragEnd)
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragEnd)

  if (dragOffset.value > DISMISS_THRESHOLD) {
    emit('close')
  } else {
    dragOffset.value = 0
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="sheet-backdrop" @click="handleBackdropClick">
        <div
          class="sheet-window"
          :class="{ dragging: isDragging }"
          :style="{ transform: dragOffset ? `translateY(${dragOffset}px)` : '' }"
          @click.stop
        >
          <!-- Drag-to-dismiss area: handle + (optional) header -->
          <div
            class="sheet-drag-area"
            @touchstart.passive="onDragStart"
            @mousedown="onDragStart"
          >
            <div class="sheet-handle"></div>
            <div v-if="title" class="sheet-header">
              <h3>{{ title }}</h3>
              <button class="sheet-close" @click.stop="emit('close')">×</button>
            </div>
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
  /* Spring back to position when drag is released without dismissal */
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* No transition while actively dragging — sheet should follow finger 1:1 */
.sheet-window.dragging {
  transition: none;
}

/* Wraps the handle + optional header so the whole top area is draggable */
.sheet-drag-area {
  cursor: grab;
  touch-action: none;  /* prevents page scroll fighting the drag */
  user-select: none;
}

.sheet-drag-area:active {
  cursor: grabbing;
}

.sheet-handle {
  width: 44px;
  height: 5px;
  background: var(--text-secondary);
  border-radius: 3px;
  margin: 10px auto 4px;
  opacity: 0.6;
  /* Bigger invisible hit area so it's easier to grab on mobile */
  position: relative;
}

.sheet-handle::before {
  content: '';
  position: absolute;
  inset: -10px -40px;
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
