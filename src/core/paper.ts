/**
 * A4 纸与打印相关的几何常量。
 *
 * 这里的数值沿用原项目：
 * - A4 物理尺寸 210mm × 297mm
 * - 高度额外加 2mm，用于抵消 Chrome 打印时取整产生的溢出
 * - 1mm ≈ 3.78px（96dpi）
 * - 打印时浏览器会在底部留出约 10px，因此下边距不能小于它
 */
export const PAPER = {
  A4: { w: 210, h: 297 + 2 }
} as const;

export const MM_TO_PX = 3.78;
export const CHROME_PRINT_BOTTOM = 10;

export const getPaperPx = (value: "w" | "h") => Math.trunc(PAPER.A4[value] * MM_TO_PX);
