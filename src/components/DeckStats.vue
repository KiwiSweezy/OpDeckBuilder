<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import * as d3 from 'd3'
import { useCardStore } from '../stores/cardStore'

const cardStore = useCardStore()
const stats = computed(() => cardStore.deckStats)
const chartRef = ref<HTMLDivElement | null>(null)

/** Only include costs that actually have cards in the deck */
const costEntries = computed(() => {
  const curve = stats.value.costCurve
  return Object.entries(curve)
    .map(([cost, count]) => ({ cost: Number(cost), count }))
    .filter(e => e.count > 0)
    .sort((a, b) => a.cost - b.cost)
})

const CHART_HEIGHT = 100
const BAR_PADDING = 0.3
const MARGIN = { top: 16, right: 4, bottom: 18, left: 4 }

function renderChart() {
  const container = chartRef.value
  if (!container) return

  const data = costEntries.value
  const width = container.clientWidth
  const innerWidth = width - MARGIN.left - MARGIN.right
  const innerHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom

  // Scales
  const x = d3.scaleBand()
    .domain(data.map(d => String(d.cost)))
    .range([0, innerWidth])
    .padding(BAR_PADDING)

  const y = d3.scaleLinear()
    .domain([0, Math.max(...data.map(d => d.count), 1)])
    .range([innerHeight, 0])

  // Select or create SVG
  let svg = d3.select(container).select<SVGSVGElement>('svg')
  if (svg.empty()) {
    svg = d3.select(container).append('svg')
    svg.append('g').attr('class', 'bars-group')
    svg.append('g').attr('class', 'labels-group')
    svg.append('g').attr('class', 'counts-group')
  }

  svg
    .attr('width', width)
    .attr('height', CHART_HEIGHT)

  const barsG = svg.select<SVGGElement>('.bars-group')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)
  const labelsG = svg.select<SVGGElement>('.labels-group')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)
  const countsG = svg.select<SVGGElement>('.counts-group')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

  // Bars
  const bars = barsG.selectAll<SVGRectElement, typeof data[number]>('rect')
    .data(data, d => String(d.cost))

  bars.enter()
    .append('rect')
    .attr('x', d => x(String(d.cost)) ?? 0)
    .attr('width', x.bandwidth())
    .attr('y', innerHeight)
    .attr('height', 0)
    .attr('rx', 3)
    .attr('ry', 3)
    .attr('fill', 'var(--accent)')
    .attr('opacity', 0.85)
    .merge(bars)
    .transition()
    .duration(400)
    .ease(d3.easeCubicOut)
    .attr('x', d => x(String(d.cost)) ?? 0)
    .attr('width', x.bandwidth())
    .attr('y', d => d.count === 0 ? innerHeight : y(d.count))
    .attr('height', d => d.count === 0 ? 0 : innerHeight - y(d.count))

  bars.exit().remove()

  // Cost labels (bottom)
  const labels = labelsG.selectAll<SVGTextElement, typeof data[number]>('text')
    .data(data, d => String(d.cost))

  labels.enter()
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('fill', 'var(--text-secondary)')
    .attr('font-size', '10px')
    .merge(labels)
    .attr('x', d => (x(String(d.cost)) ?? 0) + x.bandwidth() / 2)
    .attr('y', innerHeight + 14)
    .text(d => d.cost)

  labels.exit().remove()

  // Count labels (top of bar)
  const counts = countsG.selectAll<SVGTextElement, typeof data[number]>('text')
    .data(data, d => String(d.cost))

  counts.enter()
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('fill', 'var(--text-secondary)')
    .attr('font-size', '9px')
    .attr('font-weight', '600')
    .merge(counts)
    .transition()
    .duration(400)
    .ease(d3.easeCubicOut)
    .attr('x', d => (x(String(d.cost)) ?? 0) + x.bandwidth() / 2)
    .attr('y', d => d.count === 0 ? innerHeight - 2 : y(d.count) - 4)
    .attr('opacity', d => d.count === 0 ? 0 : 1)
    .text(d => d.count || '')

  counts.exit().remove()
}

onMounted(() => renderChart())
watch(costEntries, () => renderChart(), { deep: true, flush: 'post' })
</script>

<template>
  <div v-if="cardStore.deckSize > 0" class="deck-stats">
    <!-- Summary pills -->
    <div class="stat-pills">
      <div v-if="stats.counter1k" class="pill">
        <span class="pill-value">{{ stats.counter1k }}</span>
        <span class="pill-label">1K</span>
      </div>
      <div v-if="stats.counter2k" class="pill">
        <span class="pill-value">{{ stats.counter2k }}</span>
        <span class="pill-label">2K</span>
      </div>
      <div v-if="stats.events" class="pill">
        <span class="pill-value">{{ stats.events }}</span>
        <span class="pill-label">Events</span>
      </div>
      <div v-if="stats.searchers" class="pill">
        <span class="pill-value">{{ stats.searchers }}</span>
        <span class="pill-label">Searchers</span>
      </div>
      <div v-if="stats.blockers" class="pill">
        <span class="pill-value">{{ stats.blockers }}</span>
        <span class="pill-label">Blockers</span>
      </div>
      <div v-if="stats.rush" class="pill">
        <span class="pill-value">{{ stats.rush }}</span>
        <span class="pill-label">Rush</span>
      </div>
      <div v-if="stats.banish" class="pill">
        <span class="pill-value">{{ stats.banish }}</span>
        <span class="pill-label">Banish</span>
      </div>
      <div v-if="stats.doubleAttack" class="pill">
        <span class="pill-value">{{ stats.doubleAttack }}</span>
        <span class="pill-label">Dbl Atk</span>
      </div>
      <div v-if="stats.onKO" class="pill">
        <span class="pill-value">{{ stats.onKO }}</span>
        <span class="pill-label">On KO</span>
      </div>
    </div>

    <!-- D3 cost curve -->
    <div class="cost-chart">
      <span class="chart-label">Cost Curve</span>
      <div ref="chartRef" class="chart-container" />
    </div>
  </div>
</template>

<style scoped>
.deck-stats {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

/* Summary pills */
.stat-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
}

.pill {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
}

.pill-value {
  color: var(--text-primary);
  font-size: 0.85rem;
  font-weight: 600;
}

.pill-label {
  color: var(--text-secondary);
  font-size: 0.7rem;
  text-transform: uppercase;
}

/* Cost curve chart */
.cost-chart {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chart-label {
  color: var(--text-secondary);
  font-size: 0.7rem;
  text-transform: uppercase;
  font-weight: bold;
}

.chart-container {
  width: 100%;
}
</style>
