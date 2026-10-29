<script setup lang="ts">
import { computed } from "vue";

interface BarItem {
  name: string;
  value: number;
}

const props = withDefaults(
  defineProps<{
    items: BarItem[];
    max?: number;
    tone?: "primary" | "success";
  }>(),
  { tone: "primary" }
);

const maxValue = computed(() =>
  props.max && props.max > 0
    ? props.max
    : Math.max(1, ...props.items.map(item => item.value))
);

const widthOf = (value: number) =>
  `${Math.max(4, Math.round(((value || 0) / maxValue.value) * 100))}%`;
</script>

<template>
  <ul class="bar-list">
    <li v-for="item in items" :key="item.name" class="bar-list__row">
      <span class="bar-list__name" :title="item.name">{{ item.name }}</span>
      <span class="bar-list__track">
        <span
          class="bar-list__bar"
          :class="`is-${tone}`"
          :style="{ width: widthOf(item.value) }"
        />
      </span>
      <span class="bar-list__value">{{ item.value }}</span>
    </li>
  </ul>
</template>

<style scoped lang="scss">
.bar-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0;
  margin: 0;
  list-style: none;

  &__row {
    display: flex;
    gap: 12px;
    align-items: center;
    font-size: var(--app-font-13);
  }

  &__name {
    flex-shrink: 0;
    width: 96px;
    overflow: hidden;
    color: var(--app-text-2);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__track {
    flex: 1;
    height: 8px;
    overflow: hidden;
    background: var(--app-subtle);
    border-radius: 999px;
  }

  &__bar {
    display: block;
    height: 100%;
    border-radius: 999px;
    transition: width 240ms var(--app-ease);

    &.is-primary {
      background: linear-gradient(90deg, var(--app-primary), var(--app-primary-hover));
    }

    &.is-success {
      background: var(--app-success);
    }
  }

  &__value {
    flex-shrink: 0;
    width: 28px;
    font-weight: 600;
    color: var(--app-text-1);
    text-align: right;
  }
}
</style>
