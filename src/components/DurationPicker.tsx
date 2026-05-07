"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { parseDurationInput } from "~/lib/duration-picker-utils";

const CHIPS = [
  { label: "15m", value: 15 },
  { label: "30m", value: 30 },
  { label: "1h", value: 60 },
  { label: "2h", value: 120 },
] as const;

type Props = {
  value: number | null;
  onChange: (minutes: number | null) => void;
};

/**
 * A controlled duration picker with quick-select chips and a numeric input.
 *
 * - Clicking a chip sets the value and syncs the numeric input.
 * - Typing in the input deselects any active chip; valid integers update value.
 * - Clearing the input sets value to null.
 * - Emits null for invalid / empty / non-positive inputs.
 */
export function DurationPicker({ value, onChange }: Props) {
  // Raw text in the numeric input field
  const [inputText, setInputText] = useState<string>(
    value != null ? String(value) : "",
  );

  // Which chip is currently highlighted (null = none / custom input)
  const activeChip =
    CHIPS.find((c) => c.value === value) != null &&
    inputText === String(value)
      ? value
      : null;

  function handleChipClick(chipValue: number) {
    setInputText(String(chipValue));
    onChange(chipValue);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setInputText(raw);
    onChange(parseDurationInput(raw));
  }

  return (
    <div className="space-y-2">
      {/* Quick-select chips */}
      <div className="flex flex-wrap gap-2">
        {CHIPS.map(({ label, value: chipValue }) => (
          <Button
            key={chipValue}
            type="button"
            variant={activeChip === chipValue ? "default" : "outline"}
            size="sm"
            onClick={() => handleChipClick(chipValue)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Numeric input */}
      <div className="flex items-center gap-2">
        <Input
          type="text"
          inputMode="numeric"
          pattern="\d*"
          placeholder="Custom (minutes)"
          value={inputText}
          onChange={handleInputChange}
          className="w-40"
        />
        <span className="text-sm text-muted-foreground">min</span>
      </div>
    </div>
  );
}
