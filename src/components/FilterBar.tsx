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

export default function FilterBar({ filters, onClear }: { filters: Filter[]; onClear?: () => void }) {
  const active = filters.some((filter) => filter.value);
  return (
    <div className="surface mb-7 flex flex-wrap items-end gap-3 p-4">
      <div className="mr-2 hidden self-center lg:block">
        <p className="data-label">筛选比赛</p>
      </div>
      {filters.map((f) => (
        <label key={f.key} className="min-w-28 flex-1 text-xs font-medium text-slate-500 sm:flex-none">
          <span className="mb-1.5 block">{f.label}</span>
          <select value={f.value} onChange={(e) => f.onChange(e.target.value)} className="field w-full min-w-28 py-1.5 sm:w-auto">
            <option value="">全部</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      {active && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="mb-0.5 text-xs font-semibold text-slate-500 hover:text-navy-900"
        >
          清除筛选
        </button>
      )}
    </div>
  );
}
