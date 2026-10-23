/**
 * 分页核心：测量每个顶层块的高度，超出内容区就插入分页符。
 *
 * 这是从原项目 vue-smart-pages 的 breakPage 抽出来的，
 * 改成了直接接收 DOM 元素，不再依赖全局 id 查询。
 *
 * 返回值给预览界面显示总页数和末页剩余空间。
 */
const NEW_PAGE = "md-it-newpage";
const BREAK_CLASS = "vue-smart-page-break";

export type PageInfo = {
  /** 总页数（至少 1 页） */
  pages: number;
  /** 最后一页已用高度（px，内容区坐标系） */
  lastPageUsed: number;
  /** 单页内容区高度（px） */
  contentHeight: number;
};

export const breakPage = (
  page: HTMLElement,
  height: number,
  top: number,
  bottom: number,
  left: number,
  right: number
): PageInfo => {
  page.querySelectorAll(`.${BREAK_CLASS}`).forEach((node) => node.remove());

  const contentHeight = height - top - bottom;

  const createBreak = (marginTop: number, pageNo: number) => {
    const element = document.createElement("div");
    element.className = BREAK_CLASS;
    // 预览用：CSS 通过 attr(data-page) 画出「第 N 页」边界标签。
    element.dataset.page = String(pageNo);
    element.style.marginTop = `${marginTop}px`;
    element.style.paddingBottom = `${bottom}px`;
    element.style.marginLeft = `-${left}px`;
    element.style.marginRight = `-${right}px`;
    return element;
  };

  let pageHeight = 0;
  let pages = 1;
  const nextPage = document.createElement("div");

  for (const child of Array.from(page.children) as HTMLElement[]) {
    const style = window.getComputedStyle(child);
    // 字号和间距都可能带小数，用 rect 高度 + 浮点 margin，
    // 避免 parseInt/clientHeight 逐项取整后累积成半行的误差。
    const childHeight =
      child.getBoundingClientRect().height +
      (Number.parseFloat(style.marginTop) || 0) +
      (Number.parseFloat(style.marginBottom) || 0);

    if (pageHeight + childHeight > contentHeight || child.classList.contains(NEW_PAGE)) {
      nextPage.appendChild(createBreak(height - pageHeight - top, pages + 1));
      pageHeight = 0;
      pages += 1;
    }

    nextPage.appendChild(child.cloneNode(true));
    pageHeight += childHeight;
  }

  page.innerHTML = nextPage.innerHTML;

  // 撑满当前页，预览时页面高度才会一致。
  // 打印 CSS 会把它重置为 0，否则会多出一张空白页。
  page.style.paddingBottom = `${height - pageHeight - top}px`;

  return { pages, lastPageUsed: pageHeight, contentHeight };
};
