/**
 * 完整备份：正文 + 照片 + 排版设置。
 *
 * 下载的 .md 只含文字；照片和排版只存在浏览器本地，
 * 换设备 / 换浏览器 / 从线上版换到单文件版时都会「丢」。
 * 导出的 .json 是唯一能把这些数据带走的形式。
 */

import { normalizeSettings, type ResumeSettings } from "./settings";

const BACKUP_FORMAT = "markdown-resume";
const BACKUP_VERSION = 1;

export type ResumeBackup = {
  markdown: string;
  photo: string;
  settings: ResumeSettings;
};

/** 照片必须以 base64 data URL 形式内嵌，才能单文件带走。 */
const PHOTO_DATA_URL_RE = /^data:image\/[a-z0-9.+-]+;base64,/i;

export const serializeBackup = ({ markdown, photo, settings }: ResumeBackup) =>
  JSON.stringify(
    {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      markdown,
      photo,
      settings
    },
    null,
    2
  );

/**
 * 解析并校验备份文件。任何结构问题都抛出可展示的中文错误，
 * 避免用户导入一个不相干的文件后把当前内容覆盖成空白。
 */
export const parseBackup = (raw: string): ResumeBackup => {
  let parsed: unknown;
  try {
    // 有些编辑器保存时会带 BOM，JSON.parse 会直接报错。
    parsed = JSON.parse(raw.replace(/^﻿/, ""));
  } catch {
    throw new Error("不是有效的 JSON 文件");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("备份文件格式不正确");
  }

  const data = parsed as Record<string, unknown>;
  if (data.format !== BACKUP_FORMAT) {
    throw new Error("不是 Markdown Resume 的备份文件");
  }
  if (typeof data.markdown !== "string") {
    throw new Error("备份文件缺少简历正文");
  }

  const photo =
    typeof data.photo === "string" && PHOTO_DATA_URL_RE.test(data.photo)
      ? data.photo
      : "";

  return {
    markdown: data.markdown,
    photo,
    settings: normalizeSettings(data.settings)
  };
};
