/**
 * 极简 debounce：只依赖浏览器 setTimeout，不额外引入依赖。
 */
export const debounce = <T extends (...args: never[]) => unknown>(fn: T, delay = 200) => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const debounced = (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };

  return debounced;
};
