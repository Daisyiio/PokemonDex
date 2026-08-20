<script setup lang="ts">
const props = defineProps<{
  labels: string[]
  values: number[]
}>()

const size = 280
const cx = size / 2
const cy = size / 2
const radius = 96

const scaleMax = Math.max(
  200,
  Math.ceil(Math.max(...props.values, 1) / 50) * 50
)

function angle(i: number): number {
  return (Math.PI * 2 * i) / props.labels.length - Math.PI / 2
}

const rings = [0.25, 0.5, 0.75, 1].map((f) => ({
  points: props.labels
    .map((_, i) => {
      const r = radius * f
      const a = angle(i)
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`
    })
    .join(' '),
}))

const axes = props.labels.map((_, i) => {
  const a = angle(i)
  return {
    x1: cx,
    y1: cy,
    x2: cx + radius * Math.cos(a),
    y2: cy + radius * Math.sin(a),
  }
})

const valuePoints = props.labels
  .map((_, i) => {
    const v = Math.min(props.values[i] ?? 0, scaleMax)
    const r = (radius * v) / scaleMax
    const a = angle(i)
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`
  })
  .join(' ')

const dots = valuePoints
  .split(' ')
  .map((p) => p.split(','))
  .map(([x, y]) => ({ x: parseFloat(x), y: parseFloat(y) }))

const labelPos = props.labels.map((_, i) => {
  const a = angle(i)
  return {
    x: cx + (radius + 26) * Math.cos(a),
    y: cy + (radius + 26) * Math.sin(a),
  }
})

const valuePos = props.labels.map((_, i) => {
  const v = Math.min(props.values[i] ?? 0, scaleMax)
  const r = (radius * v) / scaleMax
  const a = angle(i)
  const off = 14
  return {
    x: cx + (r + off) * Math.cos(a),
    y: cy + (r + off) * Math.sin(a),
  }
})

const textAnchor = (x: number) =>
  x > cx + 12 ? 'start' : x < cx - 12 ? 'end' : 'middle'
</script>

<template>
  <svg
    class="radar"
    :width="size"
    :height="size"
    viewBox="0 0 280 280"
    role="img"
    aria-label="种族值雷达图"
  >
    <polygon
      v-for="(ring, ri) in rings"
      :key="ri"
      :points="ring.points"
      fill="none"
      stroke="var(--border-faint)"
      stroke-width="1"
    />
    <line
      v-for="(ax, ai) in axes"
      :key="ai"
      :x1="ax.x1"
      :y1="ax.y1"
      :x2="ax.x2"
      :y2="ax.y2"
      stroke="var(--border-faint)"
      stroke-width="1"
    />
    <polygon
      :points="valuePoints"
      fill="var(--accent)"
      fill-opacity="0.16"
      stroke="var(--accent)"
      stroke-width="2"
      stroke-linejoin="round"
    />
    <circle
      v-for="(d, di) in dots"
      :key="di"
      :cx="d.x"
      :cy="d.y"
      r="3"
      fill="var(--accent)"
    />
    <text
      v-for="(lp, li) in labelPos"
      :key="li"
      :x="lp.x"
      :y="lp.y"
      :text-anchor="textAnchor(lp.x)"
      dominant-baseline="middle"
      font-size="12"
      fill="var(--text-2)"
    >
      {{ labels[li] }}
    </text>
    <text
      v-for="(vp, vi) in valuePos"
      :key="'v' + vi"
      :x="vp.x"
      :y="vp.y"
      :text-anchor="textAnchor(vp.x)"
      dominant-baseline="middle"
      font-size="11"
      font-weight="700"
      fill="var(--accent)"
    >
      {{ values[vi] }}
    </text>
  </svg>
</template>

<style scoped>
.radar {
  display: block;
  flex-shrink: 0;
}
</style>