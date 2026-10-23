# Markdown Resume

A browser-only Markdown resume editor with live A4 preview and print-to-PDF.
用 Markdown 编写简历，实时预览 A4 版式，直接通过浏览器打印为 PDF。

![Vue](https://img.shields.io/badge/Vue-3.4-42b883?logo=vuedotjs&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.2-646CFF?logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript&logoColor=white)

无需后端、无需注册。正文、照片和排版设置仅保存在当前浏览器中。

[功能特性](#功能特性) · [快速开始](#快速开始) · [使用指南](#使用指南) · [排版参数](#排版参数) · [自定义](#自定义) · [项目结构](#项目结构) · [安全说明](#安全说明)

## 功能特性

**编辑与预览**

- Markdown 编辑与 A4 实时预览，基于 DOM 测量自动分页
- 页数提示：总页数及末页剩余行数，预览中显示分页虚线（打印时隐藏）
- 左右分栏可拖动（20%–80%），双击复位，聚焦后用方向键微调；宽度自动保存，窄屏自动改为上下布局

**简历排版**

- 条目首行三段式单行：时间左对齐、名称居中、角色右对齐；空间不足时自动降级并截断
- 固定一寸照片位（25 × 35 mm），上传后自动居中裁剪并压缩
- `\newpage` 强制分页，`\\[10px]` 手动增加垂直间距
- 9 项排版参数实时调节，支持复制配置与恢复默认（打印时面板自动隐藏）

**内容与导出**

- 正文图片自动压缩，并以 base64 内嵌到 Markdown
- 下载 Markdown、导出/导入 JSON 备份、浏览器打印为 PDF
- 内容自动保存到 `localStorage`；存储不可用时降级为「不持久化」模式，应用仍可正常使用

![运行效果](/dist/assets/运行效果.png)

## 快速开始

环境要求：Node.js 18+、pnpm。

```bash
pnpm install
pnpm dev
```

打开终端输出的地址（默认 <http://localhost:5173>）即可使用。

构建与预览生产版本：

```bash
pnpm build    # 产物输出到 dist/
pnpm preview  # 本地预览构建产物
```

## 使用指南

### 基本流程

1. 在左侧编辑 Markdown，右侧实时预览 A4 排版。
2. 默认模板 `src/assets/default-resume.md` 同时是一份写作示例：各节正文写有简历写作建议，末尾附 Markdown 语法说明，直接替换为个人内容即可。
3. 点击「上传照片」设置右上角照片；「插入正文图片」在光标处插入图片。
4. 点击「打印 / 保存 PDF」，在浏览器打印对话框中选择「另存为 PDF」。

### Markdown 约定

#### 头部

- 第一个 `#` 标题为姓名。
- 第一个 `##` 标题或列表之前的内容视为头部；当头部包含多个段落时，最后一个段落视为联系方式行。
- 头部段落保留手动输入的空格，连续空格不会被折叠，可用于微调「电话 … 邮箱」的间距。
- 联系方式行以 `·`、`•`、`|`、`｜` 分隔各项时，分隔符会被移除，各项之间固定为两个空格；未使用分隔符时整行原样保留。

```markdown
# 张三

**求职意向：** 前端开发工程师

**电话：** 138-0000-0000      **邮箱：** zhang@example.com
```

顶部 YAML front matter 在预览中会被忽略。

#### 条目（定义列表）

```markdown
**高级前端工程师**
  : **某某科技有限公司**
  : **2022.07 - 至今**
```

渲染后，条目首行为一段三段式布局：

| 来源 | 内容 | 位置 |
| --- | --- | --- |
| 第一行 `dt` | 角色 / 职位 / 学位 | 右对齐 |
| 第一条 `:` 行 | 公司 / 学校 / 项目名 | 内容区水平居中 |
| 最后一条 `:` 行 | 时间 | 左对齐 |

当「名称 + 角色」超过内容区约 70% 时，名称自动降级为紧跟时间左对齐；仍放不下时以省略号截断，不会折行。

#### 分页与间距

`\newpage` 需单独占一行，用于强制换页：

```markdown
\newpage
```

`\\[10px]` 单独占一行，增加指定像素的垂直间距：

```markdown
\\[10px]
```

#### 照片

点击「上传照片」，照片固定在姓名右侧、顶部与姓名行齐平。

- 显示尺寸固定为 **25 × 35 mm**（5:7），不随字号缩放
- 输出为 **295 × 413 像素**（300 dpi）：上传后按 5:7 居中裁剪，再压缩为 JPEG
- 无照片或图片加载失败时，显示同尺寸虚线占位框，版面占位不变
- 照片仅存储在本地，用于预览和打印/PDF；下载的 `.md` 只包含文字
- 建议上传原图不小于 295 × 413 像素，避免放大后模糊

如需调整照片尺寸或样式，修改 `src/styles/resume.css` 中的 `.resume-photo-frame`。

#### 正文图片

「插入正文图片」会在光标处插入压缩后的图片：

```markdown
![photo.jpg](data:image/jpeg;base64,...)
```

图片最大宽度 600 px、JPEG 质量 0.78。优点是导出文件和打印结果自包含，不依赖图床；代价是 Markdown 中会出现很长的 base64 行，文件体积也会增大。压缩参数可在 `src/core/compressImage.ts` 中调整。

### 数据与持久化

应用将数据保存在当前浏览器的 `localStorage` 中：

| 数据 | 存储键 |
| --- | --- |
| 简历正文 | `markdown-resume-content` |
| 照片 | `markdown-resume-photo` |
| 排版设置 | `markdown-resume-settings` |
| 分栏宽度 | `markdown-resume-split` |

隐私模式、禁用站点数据或通过 `file://` 打开时，`localStorage` 可能不可用。此时应用进入「不持久化」状态，刷新后内容不会保留，请及时导出备份。

浏览器存储按来源隔离，`localhost`、线上域名和 `file://` 之间互不相通。更换访问方式后看不到旧数据属于正常现象，可通过备份迁移。

### 备份与恢复

「导出备份」生成 `resume-backup-YYYY-MM-DD.json`，同时包含正文、照片和排版设置：

```json
{
  "format": "markdown-resume",
  "version": 1,
  "exportedAt": "2026-10-23T08:00:00.000Z",
  "markdown": "# 张三\n...",
  "photo": "data:image/jpeg;base64,...",
  "settings": { "fsBase": 10.5, "lhBody": 1.4, "...": "..." }
}
```

「导入备份」会先校验 `format` 与各字段，越界或缺失的排版参数回退为默认值，随后覆盖当前正文、照片和排版设置；导入前会弹出确认框。照片缺失或不是 `data:image/...` 时按无照片处理。

### 打印为 PDF

点击「打印 / 保存 PDF」，在浏览器打印对话框中选择「另存为 PDF」。

- 纸张固定为 A4，浏览器页边距设为 0；实际页边距由 `#resume-paper` 的 padding 控制
- 建议勾选「背景图形」，否则主题色和边框可能不显示
- 若预览只有一页而打印结果多出空白页，检查 `src/styles/print.css` 中 `#resume-paper { padding-bottom: 0 !important }` 是否仍然存在

## 排版参数

右上角的排版托盘提供 9 项参数，修改即时生效并自动保存。

| 分组 | 控件 | 默认值 | 范围 | 步进 | 单位 |
| --- | --- | --- | --- | --- | --- |
| 全局基准 | 正文字号 | 10.5 | 9–14 | 0.5 | pt |
| 全局基准 | 正文行距 | 1.4 | 1.2–1.8 | 0.05 | × |
| 元素字号倍数 | 姓名 | 2.0 | 1.5–3.0 | 0.1 | × |
| 元素字号倍数 | 小节标题 | 1.25 | 1.1–1.6 | 0.05 | × |
| 元素字号倍数 | 条目头三段 | 1.05 | 1.0–1.2 | 0.05 | × |
| 间距与页边距 | 段落间距 | 0.3 | 0–1.0 | 0.05 | 行 |
| 间距与页边距 | 小节间距 | 0.5 | 0–3.0 | 0.1 | 行 |
| 间距与页边距 | 左右页边距 | 5 | 3–8 | 0.5 | % 页宽 |
| 间距与页边距 | 上下页边距 | 3 | 2–6 | 0.5 | % 页高 |

- 按住「−」「+」300 ms 后开始连续调节，每 120 ms 一档，到达边界自动停止。
- 也可直接键入数值：失焦或回车生效，最多两位小数；越界时夹取到边界，非数字回退原值。
- 正文字号或行距变化时，其余字号按倍数、所有以「行」为单位的间距按行高同步变化。
- 底部按钮支持复制当前配置（9 个参数的 JSON）、恢复默认（同时清空本地排版设置，不影响正文和照片）以及打印。

## 自定义

| 修改目标 | 文件 |
| --- | --- |
| 字体、主题色 | `src/core/defaults.ts` |
| 排版参数默认值与范围 | `src/core/settings.ts` |
| 字号 / 间距 token（`--fs-*` / `--sp-*`） | `src/styles/resume.css` 顶部 |
| 正文排版（标题、列表、条目三段式） | `src/styles/resume.css` |
| 照片尺寸、圆角、占位框 | `src/styles/resume.css`（`.resume-photo-frame`） |
| 分页算法 | `src/core/breakPage.ts` |
| 打印规则 | `src/styles/print.css` |
| 纸张尺寸 | `src/core/paper.ts` |
| Markdown 渲染与自定义语法 | `src/core/markdown.ts` |
| 默认示例简历 | `src/assets/default-resume.md` |

## 项目结构

```
.
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
└── src/
    ├── App.vue                    # 编辑器、预览与工具栏
    ├── main.ts
    ├── assets/default-resume.md   # 默认示例简历
    ├── components/
    │   ├── SmartPages.vue         # A4 容器、资源等待与分页调度
    │   ├── SettingsTray.vue       # 排版托盘（拖动 / 收起 / 复制 / 重置）
    │   └── StepperRow.vue         # 数值控件（步进 + 直接输入）
    ├── core/
    │   ├── backup.ts              # 备份 JSON 的序列化与校验
    │   ├── breakPage.ts           # 分页算法
    │   ├── compressImage.ts       # 图片压缩为 base64
    │   ├── debounce.ts
    │   ├── defaults.ts            # 字体与主题色
    │   ├── entryHeader.ts         # 条目首行溢出降级
    │   ├── entryOrder.ts          # 旧模板条目顺序迁移
    │   ├── markdown.ts            # markdown-it 与自定义语法
    │   ├── paper.ts               # A4 几何常量
    │   ├── settings.ts            # 9 项排版参数与持久化
    │   └── storage.ts             # localStorage 读写兜底
    └── styles/
        ├── app.css                # 编辑器与预览布局
        ├── resume.css             # 简历正文样式
        └── print.css              # 打印 / PDF 规则
```

## 技术栈

- [Vue 3](https://vuejs.org/) + [Vite](https://vitejs.dev/) + TypeScript
- [markdown-it](https://github.com/markdown-it/markdown-it) + [markdown-it-deflist](https://github.com/markdown-it/markdown-it-deflist)
- 无 UI 框架、无后端、无外部数据服务

## 安全说明

Markdown 以 `html: true` 渲染，并通过 `innerHTML` 注入，**未做 HTML 清洗**。Markdown 中的 `<script>` 或事件属性会被执行。

本工具面向本地、自行编写简历的场景。请勿粘贴来源不明的 Markdown 内容。
