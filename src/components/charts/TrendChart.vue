<script setup lang="ts">
import { computed, ref } from "vue";

interface TrendPoint {
  date: string;
  submitted: number;
  completed: number;
}

const props = withDefaults(
  defineProps<{
    data: TrendPoint[];
    height?: number;
  }>(),
  { height: 240 }
);

const VIEW_WIDTH = 720;
const PADDING = { top: 18, right: 18, bottom: 28, left: 40 };

const innerWidth = VIEW_WIDTH - PADDING.left - PADDING.right;
const innerHeight = computed(() => props.height - PADDING.top - PADDING.bottom);

const maxValue = computed(() => {
  const peak = Math.max(
    4,
    ...props.data.map(item => Math.max(item.submitted || 0, item.completed || 0))
  );
  // 顶部留 12% 余量，保证曲线不贴顶
  return Math.ceil(peak * 1.12);
});

const stepX = computed(() =>
  props.data.length > 1 ? innerWidth / (props.data.length - 1) : innerWidth
);

const pointX = (index: number) => PADDING.left + index * stepX.value;
const pointY = (value: number) =>
  PADDING.top + innerHeight.value - ((value || 0) / maxValue.value) * innerHeight.value;

const buildLine = (key: "submitted" | "completed") =>
  props.data
    .map((item, index) => `${index === 0 ? "M" : "L"}${pointX(index)},${pointY(item[key])}`)
    .join(" ");

const submittedLine = computed(() => buildLine("submitted"));
const completedLine = computed(() => buildLine("completed"));

const submittedArea = computed(
  () =>
    `${submittedLine.value} L${pointX(props.data.length - 1)},${
      PADDING.top + innerHeight.value
    } L${pointX(0)},${PADDING.top + innerHeight.value} Z`
);

const completedArea = computed(
  () =>
    `${completedLine.value} L${pointX(props.data.length - 1)},${
      PADDING.top + innerHeight.value
    } L${pointX(0)},${PADDING.top + innerHeight.value} Z`
);

/** 横向网格线（4 档） */
const gridLines = computed(() =>
  [0, 0.25, 0.5, 0.75, 1].map(ratio => ({
    y: PADDING.top + innerHeight.value * ratio,
    value: Math.round(maxValue.value * (1 - ratio))
  }))
);

/** X 轴标签：最多显示 7 个 */
const xLabels = computed(() => {
  const total = props.data.length;
  if (!total) return [];
  const step = Math.max(1, Math.ceil(total / 7));
  return props.data
    .map((item, index) => ({ index, label: item.date.slice(5) }))
    .filter(item => item.index % step === 0 || item.index === total - 1);
});

const hoverIndex = ref<number | null>(null);

function onMove(event: MouseEvent) {
  const target = event.currentTarget as SVGElement;
  const rect = target.getBoundingClientRect();
  const offset = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH;
  const raw = (offset - PADDING.left) / (stepX.value || 1);
  const index = Math.round(raw);
  hoverIndex.value = index >= 0 && index < props.data.length ? index : null;
}

const hoverPoint = computed(() =>
  hoverIndex.value === null ? null : props.data[hoverIndex.value]
);
</script>

<template>
  <div class="trend-chart">
    <svg
      class="trend-chart__svg"
      :viewBox="`0 0 ${VIEW_WIDTH} ${height}`"
      :style="{ height: `${height}px` }"
      preserveAspectRatio="none"
      @mousemove="onMove"
      @mouseleave="hoverIndex = null"
    >
      <defs>
        <linearGradient id="trendSubmittedFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--app-primary)" stop-opacity="0.18" />
          <stop offset="100%" stop-color="var(--app-primary)" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="trendCompletedFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--app-success)" stop-opacity="0.14" />
          <stop offset="100%" stop-color="var(--app-success)" stop-opacity="0" />
        </linearGradient>
      </defs>

      <!-- 网格与 Y 轴 -->
      <g v-for="line in gridLines" :key="line.y">
        <line
          :x1="PADDING.left"
          :x2="VIEW_WIDTH - PADDING.right"
          :y1="line.y"
          :y2="line.y"
          stroke="var(--app-border)"
          stroke-dasharray="3 4"
        />
        <text
          :x="PADDING.left - 8"
          :y="line.y + 3"
          text-anchor="end"
          font-size="10"
          fill="var(--app-text-4)"
        >
          {{ line.value }}
        </text>
      </g>

      <!-- 面积与折线 -->
      <path :d="completedArea" fill="url(#trendCompletedFill)" />
      <path :d="submittedArea" fill="url(#trendSubmittedFill)" />
      <path
        :d="completedLine"
        fill="none"
        stroke="var(--app-success)"
        stroke-width="2"
        stroke-linejoin="round"
      />
      <path
        :d="submittedLine"
        fill="none"
        stroke="var(--app-primary)"
        stroke-width="2"
        stroke-linejoin="round"
      />

      <!-- X 轴标签 -->
      <text
        v-for="item in xLabels"
        :key="item.index"
        :x="pointX(item.index)"
        :y="height - 8"
        text-anchor="middle"
        font-size="10"
        fill="var(--app-text-4)"
      >
        {{ item.label }}
      </text>

      <!-- 悬浮指示 -->
      <template v-if="hoverIndex !== null && hoverPoint">
        <line
          :x1="pointX(hoverIndex)"
          :x2="pointX(hoverIndex)"
          :y1="PADDING.top"
          :y2="PADDING.top + innerHeight"
          stroke="var(--app-primary-border)"
          stroke-width="1"
        />
        <circle
          :cx="pointX(hoverIndex)"
          :cy="pointY(hoverPoint.submitted)"
          r="3.5"
          fill="var(--app-container)"
          stroke="var(--app-primary)"
          stroke-width="2"
        />
        <circle
          :cx="pointX(hoverIndex)"
          :cy="pointY(hoverPoint.completed)"
          r="3.5"
          fill="var(--app-container)"
          stroke="var(--app-success)"
          stroke-width="2"
        />
      </template>
    </svg>

    <div
      v-if="hoverPoint && hoverIndex !== null"
      class="trend-chart__tooltip"
      :style="{
        left: `${(pointX(hoverIndex) / VIEW_WIDTH) * 100}%`
      }"
    >
      <span class="trend-chart__tooltip-date">{{ hoverPoint.date }}</span>
      <span class="trend-chart__tooltip-row">
        <i class="is-primary" />发起 {{ hoverPoint.submitted }}
      </span>
      <span class="trend-chart__tooltip-row">
        <i class="is-success" />完成 {{ hoverPoint.completed }}
      </span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.trend-chart {
  position: relative;
  width: 100%;

  &__svg {
    display: block;
    width: 100%;
  }

  &__tooltip {
    position: absolute;
    top: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 10px;
    font-size: var(--app-font-12);
    color: var(--app-text-1);
    pointer-events: none;
    background: var(--app-container);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-sm);
    box-shadow: var(--app-shadow-sm);
    transform: translateX(-50%);
  }

  &__tooltip-date {
    font-weight: 600;
    color: var(--app-text-2);
  }

  &__tooltip-row {
    display: flex;
    gap: 6px;
    align-items: center;
    color: var(--app-text-2);

    i {
      width: 6px;
      height: 6px;
      border-radius: 50%;

      &.is-primary {
        background: var(--app-primary);
      }

      &.is-success {
        background: var(--app-success);
      }
    }
  }
}
</style>
