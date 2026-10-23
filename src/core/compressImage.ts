/**
 * 图片压缩：缩放到最大宽度，再转成 JPEG base64。
 *
 * 选择 base64 内嵌的代价是 Markdown 里会出现很长的一行；
 * 好处是导出的 .md 和打印出来的 PDF 都是自包含的，不依赖任何图床。
 */
/** 标准一寸照：25mm × 35mm，300dpi 对应 295 × 413 像素。 */
export const PHOTO_WIDTH = 295;
export const PHOTO_HEIGHT = 413;

export const compressImage = (
  file: File,
  maxWidth = 600,
  quality = 0.78
): Promise<string> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      try {
        const scale = Math.min(1, maxWidth / image.naturalWidth);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas 2D context is unavailable");

        // JPEG 不支持透明，先铺白底，避免透明 PNG 变黑。
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片加载失败"));
    };

    image.src = url;
  });

/**
 * 标准一寸照：先按 295:413 居中裁剪，再缩放到精确的 295 × 413。
 * 这样不管用户上传的是什么比例，最终都能按 25mm × 35mm 打印。
 */
export const compressPhoto = (file: File, quality = 0.9): Promise<string> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      try {
        const targetRatio = PHOTO_WIDTH / PHOTO_HEIGHT;
        const sourceWidth = image.naturalWidth;
        const sourceHeight = image.naturalHeight;

        let sx = 0;
        let sy = 0;
        let sw = sourceWidth;
        let sh = sourceHeight;

        if (sourceWidth / sourceHeight > targetRatio) {
          // 原图偏宽：裁掉左右
          sw = sourceHeight * targetRatio;
          sx = (sourceWidth - sw) / 2;
        } else {
          // 原图偏高：裁掉上下
          sh = sourceWidth / targetRatio;
          sy = (sourceHeight - sh) / 2;
        }

        const canvas = document.createElement("canvas");
        canvas.width = PHOTO_WIDTH;
        canvas.height = PHOTO_HEIGHT;

        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas 2D context is unavailable");

        // JPEG 不支持透明，先铺白底。
        context.fillStyle = "#fff";
        context.fillRect(0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
        context.drawImage(image, sx, sy, sw, sh, 0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);

        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片加载失败"));
    };

    image.src = url;
  });
