"use client";

import { useState } from "react";

import { toDateInputValue, fromDateInputValue } from "./dateTimeInputs";
import { Button } from "../Button";

function tomorrow(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date;
}

/**
 * Duplicating a stop onto another day.
 *
 * Moving a plan is just editing its start date — the slot re-files itself under
 * the new day on save. Copying has no such equivalent, which is why duplicating
 * is the only action that needs to live here.
 *
 * `UX.md` records this control's placement as an open question on the phone,
 * blocked on Liquid Glass. It is not blocked here, and the web answer is the
 * one the item wanted: a labelled field and a button that acts on it, in the
 * form, spaced like every other field.
 */
export function CopyToDateAction({
  onDuplicate,
}: {
  onDuplicate: (targetDate: Date) => void;
}) {
  const [targetDate, setTargetDate] = useState(tomorrow);

  return (
    <div className="flex flex-col gap-three">
      <div className="flex flex-col gap-one">
        <label
          htmlFor="copy-to-date"
          className="text-field-label text-text-secondary uppercase"
        >
          Duplicate to another day
        </label>
        <input
          id="copy-to-date"
          type="date"
          value={toDateInputValue(targetDate)}
          onChange={(event) => {
            const day = fromDateInputValue(event.target.value);
            if (day) setTargetDate(day);
          }}
          className="min-h-[var(--brelly-hit-target)] w-fit rounded-control bg-background-element px-three text-default text-text"
        />
      </div>
      <Button tone="quiet" onClick={() => onDuplicate(targetDate)}>
        Duplicate
      </Button>
    </div>
  );
}
