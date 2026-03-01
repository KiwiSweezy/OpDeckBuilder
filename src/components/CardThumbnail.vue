<script setup lang="ts">
// This component's ONLY job: receive one card, show its image.
// "defineProps" tells Vue what data this component expects from its parent.
// The parent passes it like: <CardThumbnail :card="someCard" />

import type { Card } from '../types/Card'

defineProps<{
  card: Card
}>()

// defineEmits declares what events this component can fire.
// The parent listens with @select="..."
const emit = defineEmits<{
  select: [card: Card]
  preview: [card: Card]
}>()
</script>

<template>
  <div
    class="card-thumbnail"
    @click="emit('select', card)"
    @mouseenter="emit('preview', card)"
  >
    <img
      :src="card.images.small"
      :alt="card.name"
      loading="lazy"
    />
  </div>
</template>

<style scoped>
/* Each card is a fixed-size box with the image filling it */
.card-thumbnail {
  border-radius: 6px;
  overflow: hidden;       /* clips the image corners to match the border-radius */
  cursor: pointer;
  transition: transform 0.15s ease;
}

.card-thumbnail:hover {
  transform: scale(1.05);  /* subtle zoom on hover for feedback */
}

.card-thumbnail img {
  width: 100%;
  height: 100%;
  display: block;          /* removes the tiny gap below inline images */
  object-fit: cover;       /* fills the box without stretching */
}
</style>
