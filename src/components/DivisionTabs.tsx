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
    <div className="mb-5 inline-flex rounded-lg bg-slate-100 p-1">
      {divisions.map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          className={`rounded-md px-4 py-1.5 text-sm transition ${
            d === value ? 'bg-white font-semibold text-gdut-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {DIVISION_LABEL[d]}
        </button>
      ))}
    </div>
  );
}
