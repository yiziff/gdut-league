import { useState, type ChangeEvent } from 'react';
import { readStatSheetFile } from '../../lib/statSheetImage';
import {
  STAT_SHEET_TEMPLATE_FIELD_KEYS,
  STAT_SHEET_TEMPLATE_FIELD_LABELS,
} from '../../lib/statSheetTemplate';
import type { MatchStatSheetTemplate } from '../../types';

const KIND_LABEL: Record<MatchStatSheetTemplate['kind'], string> = {
  'box-score': '球员逐行统计表',
  'fiba-scoresheet': 'FIBA 记录表',
  generic: '通用表单',
};

export default function StatSheetTemplateUploader({
  template,
  draftImage,
  onImage,
  onRemove,
  onTemplateChange,
}: {
  template?: MatchStatSheetTemplate;
  draftImage: string;
  onImage: (image: string) => void;
  onRemove: () => void;
  onTemplateChange: (template: MatchStatSheetTemplate) => void;
}) {
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');

  async function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setReading(true);
    setError('');
    try {
      onImage(await readStatSheetFile(file));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '模板图片无法读取');
    } finally {
      setReading(false);
    }
  }

  const preview = draftImage || template?.imageUrl || '';

  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy-950">空白技术统计表模板</p>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
            上传本场将使用的空白表格。后台会识别字段和记录方式；赛后照片将与这张模板一起交给识别模型。
          </p>
        </div>
        {template?.imageUrl && !draftImage && (
          <a href={template.imageUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-gdut-700 hover:text-gdut-900">
            查看模板原图
          </a>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="btn-secondary cursor-pointer">
          {reading ? '正在处理模板…' : preview ? '更换模板' : '上传空白模板'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            capture="environment"
            onChange={(event) => void chooseImage(event)}
            disabled={reading}
            className="sr-only"
          />
        </label>
        {preview && (
          <button type="button" onClick={onRemove} className="text-xs font-medium text-red-600">
            移除模板
          </button>
        )}
      </div>

      {draftImage && (
        <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
          新模板已选择。保存比赛时后台会分析字段，首次分析可能需要几分钟。
        </p>
      )}
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {preview && (
        <img
          src={preview}
          alt="空白技术统计表模板预览"
          className="mt-3 max-h-80 max-w-full rounded-lg border border-slate-200 bg-white object-contain"
        />
      )}

      {template && !draftImage && (
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-600">
            模板类型：{KIND_LABEL[template.kind]}
            {template.ocrEngine ? ` · ${template.ocrEngine}` : ' · 尚未完成字段分析'}
          </p>
          {template.fields.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {template.fields.map((field) => (
                <span key={field.key} title={field.sourceLabel} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">
                  {field.label}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-amber-700">尚未识别出字段；可配置识别服务后重新上传模板。</p>
          )}
          {template.warnings.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs leading-5 text-amber-800">
              {template.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
          <details className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
            <summary className="cursor-pointer text-xs font-medium text-slate-700">校正模板类型和识别字段</summary>
            <label className="mt-3 block text-xs text-slate-500">
              模板类型
              <select
                value={template.kind}
                onChange={(event) =>
                  onTemplateChange({
                    ...template,
                    kind: event.target.value as MatchStatSheetTemplate['kind'],
                  })
                }
                className="field mt-1 w-full max-w-xs"
              >
                <option value="box-score">球员逐行统计表</option>
                <option value="fiba-scoresheet">FIBA 记录表</option>
                <option value="generic">通用表单</option>
              </select>
            </label>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {STAT_SHEET_TEMPLATE_FIELD_KEYS.map((key) => {
                const checked = template.fields.some((field) => field.key === key);
                return (
                  <label key={key} className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        onTemplateChange({
                          ...template,
                          fields: checked
                            ? template.fields.filter((field) => field.key !== key)
                            : [
                                ...template.fields,
                                { key, label: STAT_SHEET_TEMPLATE_FIELD_LABELS[key] },
                              ],
                        })
                      }
                    />
                    {STAT_SHEET_TEMPLATE_FIELD_LABELS[key]}
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate-400">调整后点击本场比赛的“保存修改”生效。</p>
          </details>
        </div>
      )}
    </section>
  );
}
