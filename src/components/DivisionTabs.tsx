import type { Division } from '../types';
import { DIVISION_LABEL } from '../sports';

interface Props {
  divisions: Division[];
  value: Division;
  onChange(d: Division): void;
}

export default function DivisionTabs({ divisions, value, onChange }: Props) {
  if (divisions.length < 2) return null;
  return (
    <div className="mb-6 inline-flex rounded-lg border border-slate-200 bg-white p-1">
      {divisions.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
            d === value ? 'bg-navy-900 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-navy-900'
          }`}
        >
          {DIVISION_LABEL[d]}
        </button>
      ))}
    </div>
  );
}
