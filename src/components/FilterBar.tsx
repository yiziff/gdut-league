export interface FilterOption {
  value: string;
  label: string;
}

export interface Filter {
  key: string;
  label: string;
  value: string;
  options: FilterOption[];
  onChange(value: string): void;
}

export default function FilterBar({ filters }: { filters: Filter[] }) {
  return (
    <div className="mb-6 flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-3">
      {filters.map((f) => (
        <label key={f.key} className="flex items-center gap-2 text-sm text-slate-600">
          {f.label}
          <select
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm focus:border-gdut-500 focus:outline-none"
          >
            <option value="">全部</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
