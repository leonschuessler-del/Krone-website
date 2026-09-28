"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { inputClass } from "./ui";

/** Editable list of short texts (features, usage options, rules). */
export function ListEditor({
  id,
  items,
  onChange,
  placeholder,
  maxLength = 120,
  maxItems = 40,
}: {
  id: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  maxLength?: number;
  maxItems?: number;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || items.includes(v) || items.length >= maxItems) return;
    onChange([...items, v]);
    setDraft("");
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };

  return (
    <div>
      {items.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {items.map((item, i) => (
            <li key={`${item}-${i}`} className="flex items-center gap-1.5 rounded-lg border border-sand bg-paper px-2.5 py-1.5 text-sm">
              <input
                aria-label={`Eintrag ${i + 1}`}
                className="min-w-0 flex-1 bg-transparent outline-none"
                value={item}
                maxLength={maxLength}
                onChange={(e) => onChange(items.map((x, k) => (k === i ? e.target.value : x)))}
              />
              <button type="button" className="rounded p-1 text-muted hover:bg-cream hover:text-ink disabled:opacity-30" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Nach oben">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="rounded p-1 text-muted hover:bg-cream hover:text-ink disabled:opacity-30"
                onClick={() => move(i, 1)}
                disabled={i === items.length - 1}
                aria-label="Nach unten"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="rounded p-1 text-muted hover:bg-danger-pale hover:text-danger" onClick={() => onChange(items.filter((_, k) => k !== i))} aria-label="Entfernen">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          id={id}
          className={cn(inputClass, "flex-1")}
          value={draft}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-stone bg-white px-3 text-sm font-semibold text-ink-soft hover:border-ink/40 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" /> Hinzufügen
        </button>
      </div>
    </div>
  );
}
