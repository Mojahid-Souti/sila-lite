"use client";

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
};

export function SearchBar({ value, onChange, placeholder }: Props) {
  const [local, setLocal] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external value changes (e.g. URL param cleared)
  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setLocal(v);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onChange(v), 300);
    },
    [onChange]
  );

  return (
    <div className="relative w-full sm:max-w-sm">
      <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-neutral-400" />
      <Input
        type="search"
        value={local}
        onChange={handleChange}
        placeholder={placeholder}
        className="h-9 bg-white pl-9"
      />
    </div>
  );
}
