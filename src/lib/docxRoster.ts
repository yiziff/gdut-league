import { inflateRawSync } from 'node:zlib';

function decodeXml(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, value: string) => String.fromCodePoint(Number(value)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** 从 docx 压缩包里取出 word/document.xml。 */
export function unzipEntry(data: Buffer, entryName: string): Buffer {
  let offset = 0;
  while (offset + 30 <= data.length) {
    if (data.readUInt32LE(offset) !== 0x04034b50) break;
    const flags = data.readUInt16LE(offset + 6);
    const method = data.readUInt16LE(offset + 8);
    const compSize = data.readUInt32LE(offset + 18);
    const nameLen = data.readUInt16LE(offset + 26);
    const extraLen = data.readUInt16LE(offset + 28);
    const name = data.subarray(offset + 30, offset + 30 + nameLen).toString('utf8');
    const start = offset + 30 + nameLen + extraLen;
    if (flags & 0x8 && compSize === 0) {
      throw new Error('这个 Word 文件的压缩方式读不了，请把表格复制后粘贴');
    }
    const compressed = data.subarray(start, start + compSize);
    if (name === entryName) {
      if (method === 0) return Buffer.from(compressed);
      if (method === 8) return inflateRawSync(compressed);
      throw new Error('这个 Word 文件的压缩方式读不了，请把表格复制后粘贴');
    }
    offset = start + compSize;
  }
  throw new Error('这个 Word 里没有表格正文');
}

/** 把 Word 正文转成可解析的文本。表格每一行用制表符隔开。 */
export function documentXmlToText(xml: string): string {
  const lines: string[] = [];
  const token = /<w:tbl[\s>]|<\/w:tbl>|<w:tr[\s>]|<\/w:tr>|<w:tc[\s>]|<\/w:tc>|<w:p[\s>/]|<\/w:p>|<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let inCell = false;
  let cell = '';
  let row: string[] = [];
  let para = '';
  for (const match of xml.matchAll(token)) {
    const tag = match[0];
    if (tag.startsWith('<w:tr')) {
      row = [];
      continue;
    }
    if (tag.startsWith('</w:tr')) {
      if (row.some((item) => item !== '')) lines.push(row.join('\t'));
      row = [];
      continue;
    }
    if (tag.startsWith('<w:tc')) {
      inCell = true;
      cell = '';
      continue;
    }
    if (tag.startsWith('</w:tc')) {
      row.push(cell.trim());
      inCell = false;
      cell = '';
      continue;
    }
    if (tag.startsWith('<w:t')) {
      const text = decodeXml(match[1] ?? '');
      if (inCell) cell += text;
      else para += text;
      continue;
    }
    if (tag.startsWith('<w:p')) {
      if (!inCell) para = '';
      continue;
    }
    if (tag.startsWith('</w:p>')) {
      if (inCell) cell += '';
      else if (para.trim()) lines.push(para.trim());
      para = '';
    }
  }
  return lines.join('\n');
}

export function docxToText(data: Buffer): string {
  const xml = unzipEntry(data, 'word/document.xml').toString('utf8');
  const text = documentXmlToText(xml).trim();
  if (!text) throw new Error('这个 Word 里没有读到名单');
  return text;
}
