<template>
  <button
    v-if="collapsed"
    ref="fab"
    type="button"
    class="settings-fab"
    :style="anchorStyle"
    title="点击展开，拖动可移动"
    @pointerdown="startFabDrag"
    @pointermove="onDrag"
    @pointerup="endDrag"
    @pointercancel="endDrag"
    @click="onFabClick"
  >
    Aa
  </button>

  <section
    v-else
    ref="panel"
    class="settings-tray"
    :style="anchorStyle"
    aria-label="排版调节"
  >
    <header
      class="tray-head"
      @pointerdown="startDrag"
      @pointermove="onDrag"
      @pointerup="endDrag"
      @pointercancel="endDrag"
    >
      <span class="tray-title">排版调节</span>
      <button type="button" class="tray-collapse" title="收起" @click.stop="collapse">
        —
      </button>
    </header>

    <div class="tray-body">
      <section v-for="group in SETTINGS_GROUPS" :key="group.title" class="tray-group">
        <p class="group-title">{{ group.title }}</p>
        <StepperRow
          v-for="control in group.controls"
          :key="control.key"
          :control="control"
          :value="settings[control.key]"
          @change="(value) => emit('change', control.key, value)"
        />
      </section>
    </div>

    <footer class="tray-foot">
      <button type="button" @click="copy">复制配置</button>
      <button type="button" @click="reset">恢复默认</button>
      <button type="button" class="primary" @click="emit('print')">打印/存PDF</button>
    </footer>

    <div v-if="toast" class="tray-toast">{{ toast }}</div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import StepperRow from "./StepperRow.vue";
import {
  SETTINGS_GROUPS,
  serializeSettings,
  type ResumeSettings,
  type SettingsKey
} from "../core/settings";

const props = defineProps<{
  settings: ResumeSettings;
}>();

const emit = defineEmits<{
  (event: "change", key: SettingsKey, value: number): void;
  (event: "reset"): void;
  (event: "print"): void;
}>();

const collapsed = ref(false);
const panel = ref<HTMLElement | null>(null);
const fab = ref<HTMLElement | null>(null);

const pos = reactive({
  x: Math.max(8, window.innerWidth - 272 - 16),
  y: 16
});
const anchorStyle = computed(() => ({
  left: `${pos.x}px`,
  top: `${pos.y}px`
}));

const sizeOf = () => {
  const element = collapsed.value ? fab.value : panel.value;
  return {
    width: element?.offsetWidth ?? (collapsed.value ? 40 : 272),
    height: element?.offsetHeight ?? 40
  };
};

/** 拖动与窗口缩放时都把面板完整留在窗口内。 */
const clampPosition = () => {
  const { width, height } = sizeOf();
  pos.x = Math.min(Math.max(8, pos.x), Math.max(8, window.innerWidth - width - 8));
  pos.y = Math.min(Math.max(8, pos.y), Math.max(8, window.innerHeight - height - 8));
};

let drag: {
  startX: number;
  startY: number;
  originX: number;
  originY: number;
} | null = null;

/** 本次手势是否已移动超过阈值，用来区分「拖动」与「点击」 */
let moved = false;
/** 收起态的圆钮拖动结束后，吞掉随之而来的那次 click */
let suppressFabClick = false;

const beginDrag = (event: PointerEvent) => {
  drag = {
    startX: event.clientX,
    startY: event.clientY,
    originX: pos.x,
    originY: pos.y
  };
  moved = false;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
};

const startDrag = (event: PointerEvent) => {
  if ((event.target as HTMLElement).closest("button")) return;
  beginDrag(event);
  event.preventDefault();
};

/**
 * 收起态圆钮本身就是一个按钮：不能 preventDefault，否则 click 可能被吞掉；
 * 改用移动距离判断，拖动只移动位置，原地点击才展开。
 */
const startFabDrag = (event: PointerEvent) => {
  suppressFabClick = false;
  beginDrag(event);
};

const onDrag = (event: PointerEvent) => {
  if (!drag) return;
  const dx = event.clientX - drag.startX;
  const dy = event.clientY - drag.startY;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
  pos.x = drag.originX + dx;
  pos.y = drag.originY + dy;
  clampPosition();
};

const endDrag = (event: PointerEvent) => {
  const element = event.currentTarget as HTMLElement;
  if (element.hasPointerCapture(event.pointerId)) {
    element.releasePointerCapture(event.pointerId);
  }
  const dragged = drag !== null && moved;
  drag = null;
  // 拖动结束后浏览器仍会补发一次 click，让 onFabClick 消费掉它
  suppressFabClick = dragged;
};

const onFabClick = () => {
  if (suppressFabClick) {
    suppressFabClick = false;
    return;
  }
  expand();
};

const collapse = () => {
  collapsed.value = true;
  nextTick(clampPosition);
};

const expand = () => {
  collapsed.value = false;
  nextTick(clampPosition);
};

/* ---------- 提示 ---------- */

const toast = ref("");
let toastTimer: number | undefined;

const showToast = (message: string) => {
  toast.value = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.value = "";
  }, 1600);
};

/* ---------- 底部按钮 ---------- */

const copy = async () => {
  const text = serializeSettings(props.settings);
  let copied = false;

  try {
    await navigator.clipboard.writeText(text);
    copied = true;
  } catch {
    // 非安全上下文或权限被拒时退回 execCommand
  }

  if (!copied) {
    try {
      const helper = document.createElement("textarea");
      helper.value = text;
      helper.style.position = "fixed";
      helper.style.left = "-9999px";
      document.body.appendChild(helper);
      helper.select();
      copied = document.execCommand("copy");
      helper.remove();
    } catch {
      copied = false;
    }
  }

  showToast(copied ? "已复制" : "复制失败");
};

const reset = () => {
  emit("reset");
  showToast("已恢复默认");
};

onMounted(() => {
  clampPosition();
  window.addEventListener("resize", clampPosition);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", clampPosition);
  window.clearTimeout(toastTimer);
});
</script>

<style scoped>
.settings-tray {
  position: fixed;
  z-index: 30;
  display: flex;
  flex-direction: column;
  width: 272px;
  max-width: calc(100vw - 16px);
  max-height: calc(100vh - 32px);
  overflow: hidden;
  color: #111827;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  box-shadow: 0 16px 40px rgb(15 23 42 / 22%);
}

.tray-head {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  padding: 8px 8px 8px 12px;
  color: #fff;
  cursor: move;
  touch-action: none;
  user-select: none;
  background: #111827;
}

.tray-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.tray-collapse {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  padding: 0;
  font-size: 14px;
  line-height: 1;
  color: #fff;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 4px;
}

.tray-collapse:hover {
  background: rgb(255 255 255 / 15%);
}

.tray-body {
  flex: 1;
  min-height: 0;
  padding: 6px 12px 10px;
  overflow: auto;
}

.tray-group + .tray-group {
  border-top: 1px solid #f1f5f9;
}

.group-title {
  margin: 10px 0 4px;
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
}

.tray-group:first-child .group-title {
  margin-top: 4px;
}

.tray-foot {
  display: flex;
  flex: none;
  gap: 6px;
  padding: 8px 12px;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
}

.tray-foot button {
  flex: 1;
  padding: 5px 4px;
  font-size: 11px;
  color: #374151;
  cursor: pointer;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 5px;
}

.tray-foot button:hover {
  background: #f3f4f6;
}

.tray-foot button.primary {
  color: #fff;
  background: #111827;
  border-color: #111827;
}

.tray-foot button.primary:hover {
  background: #1f2937;
}

.tray-toast {
  position: absolute;
  bottom: 48px;
  left: 50%;
  padding: 3px 10px;
  font-size: 11px;
  color: #fff;
  white-space: nowrap;
  pointer-events: none;
  background: #111827;
  border-radius: 999px;
  transform: translateX(-50%);
}

.settings-fab {
  position: fixed;
  z-index: 30;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  padding: 0;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  cursor: grab;
  touch-action: none;
  user-select: none;
  background: #111827;
  border: 0;
  border-radius: 50%;
  box-shadow: 0 8px 20px rgb(15 23 42 / 25%);
}

.settings-fab:hover {
  background: #1f2937;
}

@media print {
  .settings-tray,
  .settings-fab {
    display: none !important;
  }
}
</style>
