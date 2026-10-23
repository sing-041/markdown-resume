<template>
  <div ref="appEl" class="app" :style="appStyle">
    <aside class="editor-pane">
      <div class="toolbar">
        <strong class="toolbar-title">Markdown Resume</strong>
        <div class="toolbar-actions">
          <button type="button" @click="photoInput?.click()">上传照片</button>
          <button type="button" @click="bodyImageInput?.click()">插入正文图片</button>
          <button type="button" @click="downloadMarkdown">下载 .md</button>
          <button type="button" @click="exportBackup">导出备份</button>
          <button type="button" @click="backupInput?.click()">导入备份</button>
          <button type="button" class="primary" @click="printPdf">打印 / 保存 PDF</button>
        </div>
        <input
          ref="photoInput"
          type="file"
          accept="image/*"
          hidden
          @change="onPhotoChange"
        />
        <input
          ref="bodyImageInput"
          type="file"
          accept="image/*"
          hidden
          @change="onBodyImageChange"
        />
        <input
          ref="backupInput"
          type="file"
          accept="application/json,.json"
          hidden
          @change="onBackupChange"
        />
      </div>

      <textarea
        ref="textarea"
        v-model="markdown"
        class="editor"
        spellcheck="false"
        placeholder="在这里写 Markdown..."
      />

      <!-- 中文长段落里混内联标签，格式化后会拆得很难读 -->
      <!-- prettier-ignore -->
      <p class="hint">
        「上传照片」固定替换右上角 25 × 35mm 照片位（输出 295 × 413）；
        「插入正文图片」插到光标处。照片只保存在本地，用于预览与打印/PDF，
        下载 .md 时不包含照片；「导出备份」生成含正文、照片与排版设置的
        .json，「导入备份」可在换设备或换浏览器后恢复。
        支持定义列表（<code>**角色**</code> + 缩进
        <code>: 名称</code> + <code>: 时间</code>，条目首行「时间左 /
        名称居中 / 角色右」）和 <code>\newpage</code> 强制分页。
        <span v-if="status" class="status">{{ status }}</span>
      </p>
    </aside>

    <div
      class="splitter"
      :class="{ 'is-dragging': dragging }"
      role="separator"
      aria-orientation="vertical"
      aria-label="拖动调整编辑区宽度，双击复位"
      title="拖动调整编辑区宽度，双击复位"
      :aria-valuenow="Math.round(editorRatio * 100)"
      aria-valuemin="20"
      aria-valuemax="80"
      tabindex="0"
      @pointerdown="startResize"
      @pointermove="onResizeMove"
      @pointerup="endResize"
      @pointercancel="endResize"
      @dblclick="resetSplit"
      @keydown.left.prevent="nudgeSplit(-1)"
      @keydown.right.prevent="nudgeSplit(1)"
    />

    <main class="preview-pane">
      <div class="preview-bar">
        <span v-if="pageSummary" class="preview-pages">{{ pageSummary }}</span>
      </div>
      <div class="preview-scroll">
        <SmartPages
          ref="smart"
          :content="renderedMarkdown"
          :height="paperHeight"
          :width="paperWidth"
          :top="marginV"
          :bottom="bottomMargin"
          :left="marginH"
          :right="marginH"
          :font-family="fontFamily"
          :font-size="fontSizePx"
          :line-height="settings.lhBody"
          :theme-color="themeColor"
          :scale-name="settings.scaleName"
          :scale-h2="settings.scaleH2"
          :scale-entry="settings.scaleEntry"
          :sp-block="settings.spBlock"
          :sp-section="settings.spSection"
          @pages="onPages"
        />
      </div>
    </main>

    <SettingsTray
      :settings="settings"
      @change="onSettingChange"
      @reset="resetSettings"
      @print="printPdf"
    />
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch
} from "vue";
import SmartPages from "./components/SmartPages.vue";
import SettingsTray from "./components/SettingsTray.vue";
import type { PageInfo } from "./core/breakPage";
import defaultMarkdown from "./assets/default-resume.md?raw";
import { extractPhoto, renderMarkdown, stripPhotoComment } from "./core/markdown";
import { compressImage, compressPhoto } from "./core/compressImage";
import { normalizeEntryOrder } from "./core/entryOrder";
import { debounce } from "./core/debounce";
import { CHROME_PRINT_BOTTOM, getPaperPx, PAPER } from "./core/paper";
import { RESUME_THEME_COLOR, SYSTEM_SANS_FONT_FAMILY } from "./core/defaults";
import {
  DEFAULT_SETTINGS,
  clearSettings,
  loadSettings,
  saveSettings,
  type ResumeSettings,
  type SettingsKey
} from "./core/settings";
import { parseBackup, serializeBackup } from "./core/backup";
import { readStorage, removeStorage, writeStorage } from "./core/storage";

const STORAGE_KEY = "markdown-resume-content";
const PHOTO_STORAGE_KEY = "markdown-resume-photo";
const SPLIT_STORAGE_KEY = "markdown-resume-split";

/** 编辑区默认占 46%，拖动范围 20%–80%。 */
const SPLIT_DEFAULT = 0.46;
const SPLIT_MIN = 0.2;
const SPLIT_MAX = 0.8;
/** 与 app.css 里的 min-width 保持一致，避免拖出窄到不可用的分栏。 */
const EDITOR_MIN_PX = 360;
const PREVIEW_MIN_PX = 320;

/** pt → CSS px（96dpi）。10.5pt = 14px = 5 号。 */
const PT_TO_PX = 96 / 72;

const settings = reactive<ResumeSettings>(loadSettings());
const fontFamily = SYSTEM_SANS_FONT_FAMILY;
const themeColor = RESUME_THEME_COLOR;
const paperHeight = getPaperPx("h");
const paperWidth = PAPER.A4.w;

const fontSizePx = computed(() => Math.round(settings.fsBase * PT_TO_PX * 1000) / 1000);
const marginH = computed(() => Math.round((getPaperPx("w") * settings.pageMx) / 100));
const marginV = computed(() => Math.round((paperHeight * settings.pageMy) / 100));
const bottomMargin = computed(() =>
  Math.max(marginV.value - CHROME_PRINT_BOTTOM, CHROME_PRINT_BOTTOM)
);

const storedMarkdown = readStorage(STORAGE_KEY);
const initialMarkdown = storedMarkdown ?? defaultMarkdown;
const initialPhoto = readStorage(PHOTO_STORAGE_KEY) || extractPhoto(initialMarkdown);

// 兼容旧模板「名称在前、岗位在后」的条目顺序，并去掉照片注释。
const markdown = ref(normalizeEntryOrder(stripPhotoComment(initialMarkdown)));
const photo = ref(initialPhoto);
const renderedMarkdown = ref(renderMarkdown(markdown.value, photo.value));

// 兼容上一版把照片直接写在 Markdown 顶部的数据。
if (initialPhoto) {
  writeStorage(PHOTO_STORAGE_KEY, initialPhoto);
}
if (storedMarkdown !== null && markdown.value !== storedMarkdown) {
  writeStorage(STORAGE_KEY, markdown.value);
}

const photoInput = ref<HTMLInputElement>();
const bodyImageInput = ref<HTMLInputElement>();
const backupInput = ref<HTMLInputElement>();
const textarea = ref<HTMLTextAreaElement>();
const smart = ref<{ flush: () => Promise<void> }>();
const status = ref("");
const pageInfo = ref<PageInfo | null>(null);

/* ---------- 左右分栏：拖动分隔条调整编辑区宽度 ---------- */

const readSplitRatio = () => {
  const raw = readStorage(SPLIT_STORAGE_KEY);
  const value = raw === null ? Number.NaN : Number.parseFloat(raw);
  if (!Number.isFinite(value)) return SPLIT_DEFAULT;
  return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, value));
};

const appEl = ref<HTMLElement>();
const editorRatio = ref(readSplitRatio());
const dragging = ref(false);

const appStyle = computed<Record<string, string>>(() => ({
  "--editor-width": `${editorRatio.value * 100}%`
}));

const appWidth = () => appEl.value?.getBoundingClientRect().width ?? 0;

/** 百分比范围和像素下限同时满足，窗口很窄时退回中间值。 */
const clampRatio = (ratio: number, width: number) => {
  if (width <= 0) {
    return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, ratio));
  }

  const min = Math.max(SPLIT_MIN, EDITOR_MIN_PX / width);
  const max = Math.min(SPLIT_MAX, 1 - PREVIEW_MIN_PX / width);
  if (min >= max) return (min + max) / 2;
  return Math.min(max, Math.max(min, ratio));
};

const setRatio = (ratio: number, persistRatio = false) => {
  editorRatio.value = clampRatio(ratio, appWidth());
  if (persistRatio) {
    writeStorage(SPLIT_STORAGE_KEY, String(editorRatio.value));
  }
};

const startResize = (event: PointerEvent) => {
  if (event.button !== 0) return;
  event.preventDefault();
  dragging.value = true;
  document.body.classList.add("is-resizing");
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
};

const onResizeMove = (event: PointerEvent) => {
  if (!dragging.value) return;

  const width = appWidth();
  const left = appEl.value?.getBoundingClientRect().left ?? 0;
  if (width <= 0) return;
  setRatio((event.clientX - left) / width);
};

const endResize = (event: PointerEvent) => {
  if (!dragging.value) return;

  dragging.value = false;
  document.body.classList.remove("is-resizing");
  const target = event.currentTarget as HTMLElement;
  if (target.hasPointerCapture(event.pointerId)) {
    target.releasePointerCapture(event.pointerId);
  }
  writeStorage(SPLIT_STORAGE_KEY, String(editorRatio.value));
};

const resetSplit = () => {
  editorRatio.value = SPLIT_DEFAULT;
  writeStorage(SPLIT_STORAGE_KEY, String(SPLIT_DEFAULT));
};

const nudgeSplit = (direction: number) => {
  setRatio(editorRatio.value + direction * 0.02, true);
};

/**
 * 窗口变窄时把保存的百分比重新夹取一遍，
 * 否则在宽窗口存下的 80% 会把预览区挤到无法使用。
 */
const onWindowResize = () => setRatio(editorRatio.value);

onMounted(() => {
  // 首次挂载时按当前窗口宽度夹取一次保存的比例。
  setRatio(editorRatio.value);
  window.addEventListener("resize", onWindowResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", onWindowResize);
  document.body.classList.remove("is-resizing");
});

const onPages = (info: PageInfo) => {
  pageInfo.value = info;
};

/** 任意数值变化即写入同一个 JSON；「恢复默认」后把存储清空。 */
watch(settings, () => saveSettings({ ...settings }), { deep: true });

const onSettingChange = (key: SettingsKey, value: number) => {
  settings[key] = value;
};

const resetSettings = () => {
  Object.assign(settings, DEFAULT_SETTINGS);
  // 等深度监听把默认值写回后，再清空存储；下次打开时即使用内置默认值。
  nextTick(clearSettings);
};

/** 顶部提示：总页数 + 末页还能放多少行正文。 */
const pageSummary = computed(() => {
  const info = pageInfo.value;
  if (!info) return "";

  const linePx = fontSizePx.value * settings.lhBody;
  const remaining = Math.max(0, info.contentHeight - info.lastPageUsed);
  const lines = Math.floor(remaining / linePx);

  if (info.pages === 1) {
    return lines > 0 ? `共 1 页 · 剩余约 ${lines} 行` : "共 1 页 · 已满";
  }

  // \newpage 出现在文末时会出现一个空白的末页
  if (info.lastPageUsed <= 0) {
    return `共 ${info.pages} 页 · 末页空白`;
  }

  return lines > 0
    ? `共 ${info.pages} 页 · 末页剩余约 ${lines} 行`
    : `共 ${info.pages} 页 · 末页已满`;
});

const persist = () => writeStorage(STORAGE_KEY, markdown.value);

const updatePreview = debounce(() => {
  renderedMarkdown.value = renderMarkdown(markdown.value, photo.value);
  persist();
}, 200);

watch(markdown, updatePreview);
onBeforeUnmount(persist);

const printPdf = async () => {
  // 打印前立刻用最新的 Markdown 重渲染，并强制重新分页，
  // 避免 debounce 还没跑完就打开打印对话框。
  renderedMarkdown.value = renderMarkdown(markdown.value, photo.value);
  persist();
  await nextTick();
  await smart.value?.flush();

  const previousTitle = document.title;
  document.title = "Resume";
  window.print();
  document.title = previousTitle;
};

const downloadFile = (content: string, type: string, filename: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const flashStatus = (message: string) => {
  status.value = message;
  // 期间若有新提示，不要把它清掉。
  setTimeout(() => {
    if (status.value === message) status.value = "";
  }, 2000);
};

const dateStamp = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const downloadMarkdown = () => {
  persist();
  // 照片只用于预览与打印/PDF，下载的 .md 只保留文字内容。
  downloadFile(
    stripPhotoComment(markdown.value),
    "text/markdown;charset=utf-8",
    "resume.md"
  );
};

/** 完整备份：正文 + 照片 + 排版设置，换设备/浏览器后可原样恢复。 */
const exportBackup = () => {
  persist();
  downloadFile(
    serializeBackup({
      // 照片单独存，正文里不再重复写照片注释。
      markdown: stripPhotoComment(markdown.value),
      photo: photo.value,
      settings: { ...settings }
    }),
    "application/json;charset=utf-8",
    `resume-backup-${dateStamp()}.json`
  );
  flashStatus("已导出备份（正文 + 照片 + 排版）");
};

const applyBackup = (backup: ReturnType<typeof parseBackup>) => {
  markdown.value = normalizeEntryOrder(stripPhotoComment(backup.markdown));
  photo.value = backup.photo;
  if (backup.photo) writeStorage(PHOTO_STORAGE_KEY, backup.photo);
  else removeStorage(PHOTO_STORAGE_KEY);

  Object.assign(settings, backup.settings);

  // 立即重渲染并落盘，不等 markdown 的 debounce。
  renderedMarkdown.value = renderMarkdown(markdown.value, photo.value);
  persist();
};

const onBackupChange = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const backup = parseBackup(await file.text());
    // 先清空输入框，否则再次选择同一个文件不会触发 change。
    input.value = "";
    if (!window.confirm("导入会覆盖当前的正文、照片和排版设置，确定继续吗？")) {
      return;
    }

    applyBackup(backup);
    flashStatus("备份已导入");
  } catch (error) {
    input.value = "";
    status.value = error instanceof Error ? error.message : "导入失败";
  }
};

const insertAtCursor = (text: string) => {
  const element = textarea.value;
  if (!element) {
    markdown.value += text;
    return;
  }

  const start = element.selectionStart ?? markdown.value.length;
  const end = element.selectionEnd ?? markdown.value.length;
  markdown.value = markdown.value.slice(0, start) + text + markdown.value.slice(end);

  nextTick(() => {
    element.focus();
    const cursor = start + text.length;
    element.setSelectionRange(cursor, cursor);
  });
};

const updatePhoto = (dataUrl: string) => {
  // 如果用户粘贴过带照片注释的 .md，先把那段注释从编辑区清掉。
  markdown.value = stripPhotoComment(markdown.value);
  photo.value = dataUrl;
  writeStorage(PHOTO_STORAGE_KEY, dataUrl);
  renderedMarkdown.value = renderMarkdown(markdown.value, photo.value);
};

const onPhotoChange = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  status.value = "正在压缩照片…";
  try {
    const dataUrl = await compressPhoto(file);
    updatePhoto(dataUrl);
    status.value = "照片已更新（295 × 413）";
    setTimeout(() => (status.value = ""), 2000);
  } catch (error) {
    status.value = error instanceof Error ? error.message : "照片处理失败";
  } finally {
    input.value = "";
  }
};

const onBodyImageChange = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  status.value = "正在压缩图片…";
  try {
    const dataUrl = await compressImage(file);
    insertAtCursor(`\n![${file.name}](${dataUrl})\n`);
    status.value = "已插入正文图片";
    setTimeout(() => (status.value = ""), 2000);
  } catch (error) {
    status.value = error instanceof Error ? error.message : "图片处理失败";
  } finally {
    input.value = "";
  }
};
</script>
