import MarkdownIt from "markdown-it";
// @ts-expect-error 该包没有自带类型
import MarkdownItDeflist from "markdown-it-deflist";

const md = new MarkdownIt({ html: true });
md.use(MarkdownItDeflist);

/**
 * `\newpage`：强制分页。
 * 渲染成一个带 md-it-newpage 类的空 div，分页算法遇到它就直接换页。
 */
md.block.ruler.after(
  "blockquote",
  "newPage",
  (state, startLine, endLine, silent) => {
    const start = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];

    if (state.src.slice(start, max).trim() !== "\\newpage") return false;
    if (silent) return true;

    const token = state.push("newPage", "", 0);
    token.block = true;
    state.line = startLine + 1;
    return true;
  },
  { alt: ["paragraph", "reference", "blockquote", "list"] }
);

/**
 * `\\[10px]`：手动增加一行间距（简历里用来微调排版）。
 */
md.block.ruler.after(
  "newPage",
  "lineBreak",
  (state, startLine, endLine, silent) => {
    const start = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];

    const line = state.src.slice(start, max).trim();
    const match = /^\\\\\[(\d+)px\]$/.exec(line);
    if (!match) return false;
    if (silent) return true;

    const token = state.push("lineBreak", "", 0);
    token.attrSet("height", match[1]);
    token.block = true;
    state.line = startLine + 1;
    return true;
  },
  { alt: ["paragraph", "reference", "blockquote", "list"] }
);

md.renderer.rules.newPage = () => `<div class="md-it-newpage"></div>`;
md.renderer.rules.lineBreak = (tokens, idx) =>
  `<div style="height: ${tokens[idx].attrGet("height")}px"></div>`;

// 外链在新标签页打开。
const defaultLinkOpen =
  md.renderer.rules.link_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = tokens[idx].attrGet("href") ?? "";
  if (/^https?:\/\//.test(href)) {
    tokens[idx].attrSet("target", "_blank");
    tokens[idx].attrSet("rel", "noopener noreferrer");
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

/**
 * markdown-it-deflist 会把连续的 dt/dd 包成一个 <dl>。
 * 分页算法只按顶层块测量高度，一个巨大的 <dl> 无法在条目之间换页，
 * 所以这里在 `</dd>\n<dt>` 处把 <dl> 拆成多个独立的 <dl>。
 */
const resolveDeflist = (html: string) => {
  if (!html.includes("<dl>")) return html;

  return html.replace(/<dl>[\s\S]*?<\/dl>/g, (block) => {
    const body = block.slice(4, -5).trim();
    if (!body) return block;

    const entries = body.split(/<\/dd>\s*<dt>/);
    if (entries.length < 2) return block;

    return entries
      .map((entry, index) => {
        let fixed = entry;
        if (index === 0) fixed += "</dd>";
        if (index === entries.length - 1) fixed = "<dt>" + fixed;
        return `<dl>${fixed}</dl>`;
      })
      .join("\n");
  });
};

/**
 * 去掉 Markdown 顶部的 front matter。
 * 极简版不解析 front matter 里的 name/header，只把它当作注释移除。
 */
const stripFrontMatter = (text: string) =>
  text.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/, "");

/**
 * 兼容旧版本写在 Markdown 顶部的照片注释：
 *
 * <!-- resume-photo:data:image/jpeg;base64,... -->
 *
 * 现在照片只存在浏览器本地（localStorage），用于预览与打印/PDF；
 * 下载 .md 时不会再把图片写回文件。
 */
const PHOTO_COMMENT_RE = /<!--\s*resume-photo:([\s\S]*?)\s*-->\s*/;

/**
 * 照片区始终渲染 25 × 35mm 的框：
 * - 有照片：图片绝对定位铺满，object-fit: cover；
 * - 无照片：显示虚线占位框；
 * - 图片加载失败：给框加 is-failed，隐藏破图并露出占位框。
 */
const renderPhoto = (photo: string) => {
  const state = photo ? "" : " is-empty";
  const image = photo
    ? `<img class="resume-photo" src="${photo}" alt="照片" ` +
      `onerror="this.parentElement.classList.add('is-failed')" />`
    : "";

  return (
    `<div class="resume-photo-frame${state}">` +
    `<span class="resume-photo-placeholder">照片</span>` +
    image +
    `</div>`
  );
};

/**
 * 联系方式行（头部最后一个段落）：
 * 如果各项用 `·` / `•` / `|` / `｜` 分隔，就去掉这些分隔符，
 * 换成两个空格重新连接；没有分隔符时整段原样保留。
 * 头部段落本身是 white-space: pre-wrap（见 resume.css），
 * 所以手输的空格——包括连续多个空格——都会按原样显示。
 */
const CONTACT_BLOCK_RE = /<p>([\s\S]*?)<\/p>/g;
const CONTACT_SEPARATOR_RE = /\s*[·•|｜]\s*/;

const formatContactLine = (header: string) => {
  const blocks = [...header.matchAll(CONTACT_BLOCK_RE)];
  // 至少要有「求职意向」和「联系方式」两段，才把最后一段当作联系方式
  if (blocks.length < 2) return header;

  const last = blocks[blocks.length - 1];
  const inner = last[1];
  if (!CONTACT_SEPARATOR_RE.test(inner)) return header;

  const items = inner
    .split(CONTACT_SEPARATOR_RE)
    .map((item) => item.trim())
    .filter(Boolean);

  if (items.length < 2) return header;

  const contact = items.join("  ");
  const start = last.index ?? 0;
  const end = start + last[0].length;

  return (
    header.slice(0, start) +
    `<p class="resume-contact">${contact}</p>` +
    header.slice(end)
  );
};

/**
 * 固定模板约定：第一个 h2 / ul / ol 之前是头部
 * （姓名、求职意向、联系方式）。把头部包进 flex 容器，右侧固定照片位。
 *
 * 这样无论旧内容用的是 h1 + 定义列表，还是新模板的 h1 + 两段文字，
 * 照片都会出现在同一个位置。
 */
const wrapHeader = (html: string, photo: string) => {
  const boundary = html.search(/<h[23][\s>]|<ul[\s>]|<ol[\s>]/);
  const header = boundary === -1 ? html : html.slice(0, boundary);
  const rest = boundary === -1 ? "" : html.slice(boundary);

  if (!/<h1[\s>]/.test(header)) return html;

  // 照片必须是第一个子元素：它用 float 挂在右上角，后面的文字行盒
  // 才会自动避开；头部高度因此只由三行文字决定，照片可以向下溢出。
  return (
    `<div class="resume-top">` +
    `${renderPhoto(photo)}` +
    `<div class="resume-top-info">${formatContactLine(header)}</div>` +
    `</div>` +
    rest
  );
};

export const extractPhoto = (text: string) =>
  text.match(PHOTO_COMMENT_RE)?.[1]?.trim() ?? "";

export const stripPhotoComment = (text: string) => text.replace(PHOTO_COMMENT_RE, "");

export const renderMarkdown = (text: string, photoOverride = "") => {
  const photo = photoOverride || extractPhoto(text);
  const withoutPhoto = stripPhotoComment(text);
  const html = resolveDeflist(md.render(stripFrontMatter(withoutPhoto)));
  return wrapHeader(html, photo);
};
