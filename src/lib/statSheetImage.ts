const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_DATA_URL_LENGTH = 3_000_000;

/** 为 OCR 保留较高分辨率，同时把手机照片压到 API 的请求上限以内。 */
export function readStatSheetFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) return Promise.reject(new Error('请上传图片'));
  if (file.size > MAX_UPLOAD_BYTES) return Promise.reject(new Error('图片请小于 15MB'));

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      let maxSide = 2400;
      let quality = 0.9;
      let output = '';

      for (let attempt = 0; attempt < 6; attempt += 1) {
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('无法处理图片'));
          return;
        }
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        output = canvas.toDataURL('image/jpeg', quality);
        if (output.length <= MAX_DATA_URL_LENGTH) break;
        if (quality > 0.7) quality -= 0.1;
        else maxSide = Math.round(maxSide * 0.82);
      }

      if (!output || output.length > MAX_DATA_URL_LENGTH) {
        reject(new Error('图片压缩后仍然太大，请裁掉无关背景后重试'));
        return;
      }
      resolve(output);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('无法读取图片，请换成 JPG 或 PNG'));
    };
    image.src = url;
  });
}
