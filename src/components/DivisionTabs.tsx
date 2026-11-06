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
    <div className="tone-switch mb-6 inline-flex rounded-lg border p-1">
      {divisions.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
            d === value ? 'tone-switch-on' : 'text-slate-500 hover:bg-white/70 hover:text-navy-900'
          }`}
        >
          {DIVISION_LABEL[d]}
        </button>
      ))}
    </div>
  );
}
