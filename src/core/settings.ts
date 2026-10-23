/**
 * 排版调节托盘的全部 token：默认值、范围、步进、持久化。
 *
 * 托盘只读写这一份配置；SmartPages 把它翻译成 CSS 变量，
 * resume.css 再消费这些变量。全文只有这里定义的 9 个值，
 * 不要再给单个元素手写字号或块级间距。
 */

export type SettingsKey =
  | "fsBase"
  | "lhBody"
  | "scaleName"
  | "scaleH2"
  | "scaleEntry"
  | "spBlock"
  | "spSection"
  | "pageMx"
  | "pageMy";

export type ResumeSettings = Record<SettingsKey, number>;

export type SettingsUnit = "pt" | "×" | "行" | "%";

export type SettingsControl = {
  key: SettingsKey;
  label: string;
  unit: SettingsUnit;
  min: number;
  max: number;
  step: number;
};

export type SettingsGroup = {
  title: string;
  controls: SettingsControl[];
};

/** 当前调优后的默认排版；范围即托盘可调区间。 */
export const DEFAULT_SETTINGS: ResumeSettings = {
  fsBase: 10.5,
  lhBody: 1.4,
  scaleName: 2,
  scaleH2: 1.25,
  scaleEntry: 1.05,
  spBlock: 0.3,
  spSection: 0.5,
  pageMx: 5,
  pageMy: 3
};

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    title: "全局基准",
    controls: [
      {
        key: "fsBase",
        label: "正文字号",
        unit: "pt",
        min: 9,
        max: 14,
        step: 0.5
      },
      {
        key: "lhBody",
        label: "正文行距",
        unit: "×",
        min: 1.2,
        max: 1.8,
        step: 0.05
      }
    ]
  },
  {
    title: "元素字号倍数",
    controls: [
      {
        key: "scaleName",
        label: "姓名",
        unit: "×",
        min: 1.5,
        max: 3,
        step: 0.1
      },
      {
        key: "scaleH2",
        label: "小节标题",
        unit: "×",
        min: 1.1,
        max: 1.6,
        step: 0.05
      },
      {
        key: "scaleEntry",
        label: "条目头三段",
        unit: "×",
        min: 1,
        max: 1.2,
        step: 0.05
      }
    ]
  },
  {
    title: "间距与页边距",
    controls: [
      {
        key: "spBlock",
        label: "段落间距",
        unit: "行",
        min: 0,
        max: 1,
        step: 0.05
      },
      {
        key: "spSection",
        label: "小节间距",
        unit: "行",
        min: 0,
        max: 3,
        step: 0.1
      },
      {
        key: "pageMx",
        label: "左右页边距",
        unit: "%",
        min: 3,
        max: 8,
        step: 0.5
      },
      {
        key: "pageMy",
        label: "上下页边距",
        unit: "%",
        min: 2,
        max: 6,
        step: 0.5
      }
    ]
  }
];

export const SETTINGS_CONTROLS = SETTINGS_GROUPS.flatMap((group) => group.controls);

export const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS) as SettingsKey[];

const CONTROL_BY_KEY = SETTINGS_CONTROLS.reduce(
  (map, control) => {
    map[control.key] = control;
    return map;
  },
  {} as Record<SettingsKey, SettingsControl>
);

const roundToHundredth = (value: number) => Math.round(value * 100) / 100;

/** 夹取到控件范围内，并统一保留最多两位小数。 */
export const clampSetting = (key: SettingsKey, value: number) => {
  const control = CONTROL_BY_KEY[key];
  return Math.min(control.max, Math.max(control.min, roundToHundredth(value)));
};

export const SETTINGS_STORAGE_KEY = "markdown-resume-settings";

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * 把任意来源（本地存储 / 导入的备份文件）的配置收紧到合法范围：
 * 缺字段、非数字、越界都回退到默认值。
 */
export const normalizeSettings = (value: unknown): ResumeSettings => {
  const next: ResumeSettings = { ...DEFAULT_SETTINGS };
  if (!value || typeof value !== "object") return next;

  for (const key of SETTINGS_KEYS) {
    const item = (value as Record<string, unknown>)[key];
    if (isFiniteNumber(item)) next[key] = clampSetting(key, item);
  }
  return next;
};

/** 损坏、缺字段或越界的旧配置都回退到默认值。 */
export const loadSettings = (): ResumeSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return normalizeSettings(JSON.parse(raw));
  } catch {
    // localStorage 不可用或 JSON 损坏时静默使用默认值
    return { ...DEFAULT_SETTINGS };
  }
};

/** 任意数值变化都写回同一个 JSON。 */
export const saveSettings = (settings: ResumeSettings) => {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 隐私模式 / 配额不足时忽略
  }
};

export const clearSettings = () => {
  try {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
  } catch {
    // 忽略
  }
};

/** 按 #1–#9 的固定顺序导出，供「复制配置」使用。 */
export const serializeSettings = (settings: ResumeSettings) =>
  JSON.stringify(
    Object.fromEntries(SETTINGS_KEYS.map((key) => [key, settings[key]])),
    null,
    2
  );
