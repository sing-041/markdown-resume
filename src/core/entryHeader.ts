/**
 * 条目头三段式布局的溢出降级。
 *
 * 默认：时间（左）/ 名称（内容区正中）/ 角色（右）。
 * 当「名称 + 角色」超过内容区 70% 时，名称降级为紧跟时间约 2 字宽处
 * 左对齐；仍放不下则省略号截断，绝不换行。
 */

const DEGRADED_CLASS = "is-degraded";
const TRUNCATED_CLASS = "is-truncated";

/** 用离屏克隆量出一段文本的自然宽度（含加粗、字距）。 */
const measureTextWidth = (element: HTMLElement, paper: HTMLElement) => {
  const style = window.getComputedStyle(element);
  const probe = element.cloneNode(true) as HTMLElement;

  probe.style.position = "absolute";
  probe.style.top = "-10000px";
  probe.style.left = "0";
  probe.style.visibility = "hidden";
  probe.style.display = "inline-block";
  probe.style.width = "auto";
  probe.style.maxWidth = "none";
  probe.style.margin = "0";
  probe.style.padding = "0";
  probe.style.whiteSpace = "nowrap";
  probe.style.fontFamily = style.fontFamily;
  probe.style.fontSize = style.fontSize;
  probe.style.fontWeight = style.fontWeight;
  probe.style.fontStyle = style.fontStyle;
  probe.style.letterSpacing = style.letterSpacing;

  paper.appendChild(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();

  return width;
};

export const fitEntryHeaders = (paper: HTMLElement) => {
  const entries = paper.querySelectorAll<HTMLElement>("dl");

  entries.forEach((dl) => {
    dl.classList.remove(DEGRADED_CLASS, TRUNCATED_CLASS);

    const date = dl.querySelector<HTMLElement>(":scope > dd:last-child");
    const role = dl.querySelector<HTMLElement>(":scope > dt");
    const name = dl.querySelector<HTMLElement>(
      ":scope > dd:first-of-type:not(:last-child)"
    );

    if (!date || !role || !name) return;

    const width = dl.clientWidth;
    if (!width) return;

    const dateWidth = measureTextWidth(date, paper);
    const roleWidth = measureTextWidth(role, paper);
    const nameWidth = measureTextWidth(name, paper);

    if (nameWidth + roleWidth <= width * 0.7) return;

    dl.classList.add(DEGRADED_CLASS);

    const styles = window.getComputedStyle(dl);
    const gap = Number.parseFloat(styles.columnGap) || 0;
    const fontSize = Number.parseFloat(styles.fontSize) || 12;
    // CSS 里中段 margin-left: 1.3em，加上列间距后约为 2 个正文字符。
    const offset = fontSize * 1.3;
    const available = width - dateWidth - roleWidth - gap * 2 - offset;

    if (nameWidth > available) {
      dl.classList.add(TRUNCATED_CLASS);
    }
  });
};
