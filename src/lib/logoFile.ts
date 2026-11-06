/** 把头像裁成正方形再缩小，方便放进圆形头像。 */
export function readAvatarFile(file: File): Promise<string> {
  return readImageFile(file, true);
}

/** 把上传的标志缩成小图，再交给接口保存。 */
export function readLogoFile(file: File): Promise<string> {
  return readImageFile(file, false);
}

function readImageFile(file: File, square: boolean): Promise<string> {
  if (!file.type.startsWith('image/')) return Promise.reject(new Error('请上传图片'));
  if (file.size > 5 * 1024 * 1024) return Promise.reject(new Error('图片请小于 5MB'));
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const max = 256;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      URL.revokeObjectURL(url);
      if (!ctx) {
        reject(new Error('无法处理图片'));
        return;
      }
      if (square) {
        const side = Math.min(image.width, image.height);
        const sx = (image.width - side) / 2;
        const sy = (image.height - side) / 2;
        canvas.width = max;
        canvas.height = max;
        ctx.drawImage(image, sx, sy, side, side, 0, 0, max, max);
      } else {
        const scale = Math.min(1, max / Math.max(image.width, image.height));
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      }
      resolve(canvas.toDataURL('image/jpeg', 0.86));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('无法读取图片'));
    };
    image.src = url;
  });
}
