"use client";

import type { CategoryOut } from "@/lib/api";

type Props = {
  categories: CategoryOut[];
  selected: string[];
  onChange: (ids: string[]) => void;
  label: string;
};

export function CategoryFilter({ categories, selected, onChange, label }: Props) {
  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  if (categories.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-neutral-500 text-xs">{label}:</span>
      {categories.map((cat) => {
        const active = selected.includes(cat.id);
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => toggle(cat.id)}
            className={`rounded-full border px-2.5 py-1 font-medium text-xs transition-colors ${
              active
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50"
            }`}
          >
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}
