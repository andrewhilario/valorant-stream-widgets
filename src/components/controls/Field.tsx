import type { ReactNode } from "react";

type Shared = {
  label: string;
  help?: string;
  error?: string | null;
  /** id for the helper line, so the control can reference it with aria-describedby. */
  helpId: string;
  /** Rendered after the helper line, e.g. a how-to disclosure. */
  after?: ReactNode;
  children: ReactNode;
};

function Help({ id, text, error }: { id: string; text?: string; error?: string | null }) {
  // One line, always reserved, so an error appearing never pushes the form down.
  return (
    <p className="field__help" id={id} data-error={error ? "true" : "false"}>
      {error ?? text}
    </p>
  );
}

/** Label + single control (text, range). */
export function Field({
  label,
  help,
  error,
  helpId,
  htmlFor,
  aside,
  after,
  children,
}: Shared & { htmlFor: string; aside?: ReactNode }) {
  return (
    <div className="field">
      <div className="field__row">
        <label className="field__label" htmlFor={htmlFor}>
          {label}
        </label>
        {aside}
      </div>
      {children}
      <Help id={helpId} text={help} error={error} />
      {after}
    </div>
  );
}

/** Legend + radio/checkbox group. */
export function FieldGroup({ label, help, error, helpId, after, children }: Shared) {
  return (
    <fieldset className="field" aria-describedby={helpId}>
      <legend className="field__label">{label}</legend>
      {children}
      <Help id={helpId} text={help} error={error} />
      {after}
    </fieldset>
  );
}
