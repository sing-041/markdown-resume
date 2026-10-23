<template>
  <div class="row">
    <span class="row-label">{{ control.label }}</span>

    <button
      type="button"
      class="step"
      :disabled="atMin"
      :aria-label="`减小${control.label}`"
      @pointerdown="startPress(-1)"
      @click="onClick(-1)"
      @contextmenu.prevent
    >
      −
    </button>

    <label class="value-box" :class="{ 'is-shaking': shaking }">
      <input
        ref="input"
        :value="draft"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        spellcheck="false"
        :aria-label="control.label"
        @focus="onFocus"
        @input="onInput"
        @blur="onBlur"
        @keydown.enter.prevent="commit"
        @keydown.esc.prevent="cancel"
      />
      <span class="unit">{{ control.unit }}</span>
    </label>

    <button
      type="button"
      class="step"
      :disabled="atMax"
      :aria-label="`增大${control.label}`"
      @pointerdown="startPress(1)"
      @click="onClick(1)"
      @contextmenu.prevent
    >
      +
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { clampSetting, type SettingsControl } from "../core/settings";

const props = defineProps<{
  control: SettingsControl;
  value: number;
}>();

const emit = defineEmits<{
  (event: "change", value: number): void;
}>();

const input = ref<HTMLInputElement>();
const focused = ref(false);
const shaking = ref(false);
const draft = ref(format(props.value));

function format(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

const atMin = computed(() => props.value <= props.control.min + 1e-9);
const atMax = computed(() => props.value >= props.control.max - 1e-9);

watch(
  () => props.value,
  (value) => {
    // 用户正在键入时不要抢走输入框的内容
    if (!focused.value) draft.value = format(value);
  }
);

/* ---------- 步进 / 长按连发 ---------- */

let holdTimer: number | undefined;
let repeatTimer: number | undefined;
let releaseHandler: (() => void) | undefined;
/** 长按已经产生过步进：吞掉随后的那次 click。 */
let longPressFired = false;

const endPress = () => {
  if (holdTimer !== undefined) {
    clearTimeout(holdTimer);
    holdTimer = undefined;
  }
  if (repeatTimer !== undefined) {
    clearInterval(repeatTimer);
    repeatTimer = undefined;
  }
  if (releaseHandler) {
    window.removeEventListener("pointerup", releaseHandler);
    window.removeEventListener("pointercancel", releaseHandler);
    releaseHandler = undefined;
  }
};

/** 返回 false 表示已经到边界，长按连发应停止。 */
const step = (direction: number) => {
  const next = clampSetting(
    props.control.key,
    props.value + direction * props.control.step
  );
  if (next === props.value) return false;
  emit("change", next);
  return next > props.control.min + 1e-9 && next < props.control.max - 1e-9;
};

const startPress = (direction: number) => {
  endPress();
  longPressFired = false;

  releaseHandler = () => endPress();
  window.addEventListener("pointerup", releaseHandler, { once: true });
  window.addEventListener("pointercancel", releaseHandler, { once: true });

  holdTimer = window.setTimeout(() => {
    longPressFired = true;
    if (!step(direction)) {
      endPress();
      return;
    }
    repeatTimer = window.setInterval(() => {
      if (!step(direction)) endPress();
    }, 120);
  }, 300);
};

/** 单击：长按结束后浏览器仍会补发一次 click，需要吞掉。 */
const onClick = (direction: number) => {
  if (longPressFired) {
    longPressFired = false;
    return;
  }
  step(direction);
};

/* ---------- 直接键入 ---------- */

const revert = () => {
  draft.value = format(props.value);
  // 先取下再挂上，连续输错时动画也能重新播放
  shaking.value = false;
  nextTick(() => (shaking.value = true));
  window.clearTimeout(shakeTimer);
  shakeTimer = window.setTimeout(() => (shaking.value = false), 260);
};

const commit = () => {
  const raw = draft.value.trim();
  const parsed = Number(raw);
  if (raw === "" || !Number.isFinite(parsed)) {
    revert();
    return;
  }
  const next = clampSetting(props.control.key, parsed);
  draft.value = format(next);
  if (next !== props.value) emit("change", next);
};

const onFocus = () => {
  focused.value = true;
  nextTick(() => input.value?.select());
};

const onInput = (event: Event) => {
  draft.value = (event.target as HTMLInputElement).value;
};

const onBlur = () => {
  commit();
  focused.value = false;
};

const cancel = () => {
  draft.value = format(props.value);
  focused.value = false;
  input.value?.blur();
};

let shakeTimer: number | undefined;

onBeforeUnmount(() => {
  endPress();
  window.clearTimeout(shakeTimer);
});
</script>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
}

.row-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  color: #374151;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.step {
  display: grid;
  flex: none;
  place-items: center;
  width: 22px;
  height: 22px;
  padding: 0;
  font-size: 14px;
  line-height: 1;
  color: #374151;
  cursor: pointer;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  user-select: none;
  touch-action: none;
}

.step:hover:not(:disabled) {
  background: #f3f4f6;
}

.step:disabled {
  color: #cbd5e1;
  cursor: not-allowed;
}

.value-box {
  display: flex;
  flex: none;
  align-items: center;
  width: 74px;
  height: 22px;
  padding: 0 4px;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 4px;
}

.value-box:focus-within {
  border-color: #2563eb;
}

.value-box input {
  flex: 1;
  min-width: 0;
  padding: 0;
  font: inherit;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: #111827;
  text-align: right;
  background: transparent;
  border: 0;
  outline: none;
}

.unit {
  flex: none;
  padding-left: 2px;
  font-size: 11px;
  color: #9ca3af;
}

.is-shaking {
  animation: shake 0.25s ease;
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }

  25% {
    transform: translateX(-2px);
  }

  75% {
    transform: translateX(2px);
  }
}
</style>
