/**
 * localStorage 的读写包装。
 *
 * 隐私模式、禁用站点数据、以及部分浏览器打开 file:// 页面时，
 * 直接访问 localStorage 会抛异常；这里统一吞掉，让应用退回
 * 「不持久化」但可正常使用、可导出备份的状态。
 */

export const readStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const writeStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 配额不足或被禁用时忽略
  }
};

export const removeStorage = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // 忽略
  }
};
