"use client";

import { useId } from "react";
import type { PreviewStatus } from "@/lib/preview";
import { hasFlag, type Config, type Control, type ConfigValue } from "@/lib/schema";
import { FieldGroup } from "./Field";
import { Gallery } from "./Gallery";
import { Range } from "./Range";
import { Segmented } from "./Segmented";
import { SelectControl } from "./Select";
import { Swatches } from "./Swatches";
import { Switch } from "./Switch";
import { TextField } from "./TextField";

export type Lookup = {
  status: PreviewStatus;
  account: string | null;
  tier: string | null;
  configured: boolean;
  sample: boolean;
};

type Props = {
  control: Control;
  config: Config;
  onChange: (key: string, value: ConfigValue) => void;
  lookup: Lookup;
  /** Try a choice's option on the preview without picking it (a gallery calls this as the pointer moves over its cards). */
  onTry?: (key: string, value: string | null) => void;
};

function Flags({ control, config, onChange }: Props & { control: Extract<Control, { kind: "flags" }> }) {
  const id = useId();
  const current = String(config[control.key] ?? "");

  const toggle = (flag: string, on: boolean) => {
    const wanted = new Set(current.split(",").filter(Boolean));
    if (on) wanted.add(flag);
    else wanted.delete(flag);
    // Canonical order keeps the link stable whichever order boxes are ticked.
    onChange(control.key, control.options.map((o) => o.value).filter((v) => wanted.has(v)).join(","));
  };

  return (
    <FieldGroup label={control.label} help={control.help} helpId={`${id}-help`}>
      <div className="switches">
        {control.options.map((option) => {
          const applies = option.appliesTo ? option.appliesTo(config) : true;
          return (
            <Switch
              key={option.value}
              label={option.label}
              checked={hasFlag(current, option.value)}
              onChange={(on) => toggle(option.value, on)}
              disabled={!applies}
              hint={applies ? undefined : "Not used by this layout"}
              ctl={control.key}
              flag={option.value}
            />
          );
        })}
      </div>
    </FieldGroup>
  );
}

/** Renders one schema control as the right widget. */
export function ControlView(props: Props) {
  const { control, config, onChange, lookup, onTry } = props;
  if (control.showWhen && !control.showWhen(config)) return null;

  const value = config[control.key];

  switch (control.kind) {
    case "text":
      return (
        <TextField control={control} value={String(value ?? "")} onChange={(v) => onChange(control.key, v)} lookup={lookup} />
      );
    case "choice":
      if (control.display === "gallery") {
        return <Gallery control={control} value={String(value)} onChange={(v) => onChange(control.key, v)} onTry={onTry} />;
      }
      if (control.display === "select" || control.options.length > 5) {
        return <SelectControl control={control} value={String(value)} onChange={(v) => onChange(control.key, v)} />;
      }
      return <Segmented control={control} value={String(value)} onChange={(v) => onChange(control.key, v)} />;
    case "range":
      return <Range control={control} value={Number(value)} onChange={(v) => onChange(control.key, v)} />;
    case "toggle":
      return (
        <div className="field field--switch">
          <Switch
            label={control.label}
            checked={Boolean(value)}
            onChange={(on) => onChange(control.key, on)}
            ctl={control.key}
          />
          {control.help && <p className="field__help">{control.help}</p>}
        </div>
      );
    case "color":
      return <Swatches control={control} value={String(value ?? "")} onChange={(v) => onChange(control.key, v)} />;
    case "flags":
      return <Flags {...props} control={control} />;
  }
}
