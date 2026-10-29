<script setup lang="ts">
import { computed } from "vue";

interface DonutItem {
  label: string;
  value: number;
  color?: string;
}

const props = withDefaults(
  defineProps<{
    items: DonutItem[];
    size?: number;
    thickness?: number;
    centerLabel?: string;
  }>(),
  { size: 168, thickness: 18, centerLabel: "总计" }
);

/** 默认配色：主色 + 语义色，保持克制 */
const DEFAULT_COLORS = [
  "var(--app-primary)",
  "var(--app-success)",
  "var(--app-warning)",
  "var(--app-danger)",
  "var(--app-text-4)",
  "var(--app-primary-border)"
];

const total = computed(() =>
  props.items.reduce((sum, item) => sum + (item.value || 0), 0)
);

const radius = computed(() => (props.size - props.thickness) / 2);
const circumference = computed(() => 2 * Math.PI * radius.value);

const segments = computed(() => {
  let offset = 0;
  return props.items.map((item, index) => {
    const ratio = total.value ? item.value / total.value : 0;
    const length = ratio * circumference.value;
    const segment = {
      ...item,
      color: item.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length],
      dasharray: `${length} ${circumference.value - length}`,
      dashoffset: -offset,
      ratio
    };
    offset += length;
    return segment;
  });
});
</script>

<template>
  <div class="donut">
    <div class="donut__ring" :style="{ width: `${size}px`, height: `${size}px` }">
      <svg :viewBox="`0 0 ${size} ${size}`">
        <circle
          :cx="size / 2"
          :cy="size / 2"
          :r="radius"
          fill="none"
          stroke="var(--app-subtle)"
          :stroke-width="thickness"
        />
        <circle
          v-for="segment in segments"
          :key="segment.label"
          :cx="size / 2"
          :cy="size / 2"
          :r="radius"
          fill="none"
          :stroke="segment.color"
          :stroke-width="thickness"
          :stroke-dasharray="segment.dasharray"
          :stroke-dashoffset="segment.dashoffset"
          stroke-linecap="butt"
          :transform="`rotate(-90 ${size / 2} ${size / 2})`"
        />
      </svg>
      <div class="donut__center">
        <span class="donut__value">{{ total }}</span>
        <span class="donut__label">{{ centerLabel }}</span>
      </div>
    </div>

    <ul class="donut__legend">
      <li v-for="segment in segments" :key="segment.label">
        <i :style="{ background: segment.color }" />
        <span class="donut__legend-label">{{ segment.label }}</span>
        <span class="donut__legend-value">{{ segment.value }}</span>
        <span class="donut__legend-ratio">
          {{ Math.round(segment.ratio * 100) }}%
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.donut {
  display: flex;
  gap: 20px;
  align-items: center;

  &__ring {
    position: relative;
    flex-shrink: 0;

    svg {
      width: 100%;
      height: 100%;
    }
  }

  &__center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    align-items: center;
    justify-content: center;
  }

  &__value {
    font-size: var(--app-font-20);
    font-weight: 600;
    color: var(--app-text-1);
  }

  &__label {
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__legend {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    padding: 0;
    margin: 0;
    list-style: none;

    li {
      display: flex;
      gap: 8px;
      align-items: center;
      font-size: var(--app-font-13);
      color: var(--app-text-2);
    }

    i {
      flex-shrink: 0;
      width: 8px;
      height: 8px;
      border-radius: 2px;
    }
  }

  &__legend-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__legend-value {
    font-weight: 600;
    color: var(--app-text-1);
  }

  &__legend-ratio {
    width: 36px;
    font-size: var(--app-font-12);
    color: var(--app-text-3);
    text-align: right;
  }
}
</style>
