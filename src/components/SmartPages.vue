<template>
  <div
    id="resume-paper"
    ref="page"
    class="resume-paper"
    :style="pageStyle"
    v-html="content"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import type { CSSProperties } from "vue";
import { breakPage } from "../core/breakPage";
import type { PageInfo } from "../core/breakPage";
import { debounce } from "../core/debounce";
import { fitEntryHeaders } from "../core/entryHeader";

const props = defineProps<{
  content: string;
  /** 页面总高度（px，含上下边距） */
  height: number;
  /** 纸宽（mm） */
  width: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  themeColor: string;
  /** 元素字号倍数（相对正文字号） */
  scaleName: number;
  scaleH2: number;
  scaleEntry: number;
  /** 块级间距，单位：行 */
  spBlock: number;
  spSection: number;
}>();

const emit = defineEmits<{
  (event: "pages", info: PageInfo): void;
}>();

const page = ref<HTMLElement>();
let mounted = false;

const pageStyle = computed<CSSProperties>(() => ({
  width: `${props.width}mm`,
  minHeight: `${props.height}px`,
  padding: `${props.top}px ${props.right}px ${props.bottom}px ${props.left}px`,
  // 正文字号只作为 token 的基准，实际字号由 resume.css 的 --fs-* 控制。
  "--resume-base": `${props.fontSize}px`,
  "--resume-line-height": String(props.lineHeight),
  "--scale-name": String(props.scaleName),
  "--scale-h2": String(props.scaleH2),
  "--scale-entry": String(props.scaleEntry),
  "--sp-block-lines": String(props.spBlock),
  "--sp-section-lines": String(props.spSection),
  fontFamily: props.fontFamily,
  "--resume-theme-color": props.themeColor
}));

/**
 * 分页前必须等图片解码完成，否则测到的高度是错的；
 * 字体同理。
 */
const waitForAssets = async (element: HTMLElement) => {
  await Promise.allSettled([
    document.fonts.load(`${props.fontSize}px ${props.fontFamily}`)
  ]);
  await document.fonts.ready;

  const images = Array.from(element.querySelectorAll("img"));
  await Promise.all(
    images.map((image) =>
      image.decode ? image.decode().catch(() => undefined) : Promise.resolve()
    )
  );
};

const paginate = async (delay = 0) => {
  if (!mounted || !page.value) return;

  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  await nextTick();
  const element = page.value;
  await waitForAssets(element);

  // 先按内容宽度决定条目头是否降级/截断，再做分页测量。
  fitEntryHeaders(element);

  const info = breakPage(
    element,
    props.height,
    props.top,
    props.bottom,
    props.left,
    props.right
  );

  emit("pages", info);
};

const resolvePages = debounce(paginate, 200);

/** 打印前调用：取消防抖并立即重新分页，确保最后一次编辑进入打印结果。 */
const flush = async () => {
  resolvePages.cancel();
  await paginate(0);
};

const schedule = () => resolvePages(100);

watch(
  () => [
    props.content,
    props.height,
    props.width,
    props.top,
    props.bottom,
    props.left,
    props.right,
    props.fontFamily,
    props.fontSize,
    props.lineHeight,
    props.scaleName,
    props.scaleH2,
    props.scaleEntry,
    props.spBlock,
    props.spSection
  ],
  schedule,
  { flush: "post" }
);

onMounted(() => {
  mounted = true;
  resolvePages(100);
});

defineExpose({ flush, resolvePages });
</script>
