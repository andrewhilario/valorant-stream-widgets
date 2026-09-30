import type { ReactNode } from "react";

/** One line, always reserved, so the label appearing or disappearing never moves the figure below it. */
export function StatusLine({ tone, children }: { tone: "example" | "live" | "none"; children?: ReactNode }) {
  return (
    <p className="status result__status" data-tone={tone === "live" ? "live" : "idle"}>
      {tone !== "none" && <span className="status__dot" aria-hidden="true" />}
      <span>{children}</span>
    </p>
  );
}

/** The big number, with its unit and a worded headline so the figure is never alone. */
export function Figure({ value, unit, headline }: { value: string; unit: string; headline: ReactNode }) {
  return (
    <div className="result__main">
      <p className="result__figure">
        <span className="result__num">{value}</span>
        <span className="result__unit">{unit}</span>
      </p>
      <p className="result__headline">{headline}</p>
    </div>
  );
}

/**
 * Where the answer sits between its fast and slow cases. The bar is decoration; the three labelled numbers under
 * it carry the meaning, so nothing depends on seeing the bar.
 */
export function Gauge({
  low,
  mid,
  high,
  labels,
  unit,
}: {
  low: number;
  mid: number;
  high: number;
  labels: [string, string, string];
  unit: string;
}) {
  const top = Math.max(low, mid, high, 1) * 1.04;
  const at = (n: number) => `${Math.min(100, Math.max(0, (n / top) * 100)).toFixed(2)}%`;
  const from = Math.min(low, high);
  const to = Math.max(low, high);

  return (
    <div className="gauge">
      <div className="gauge__track" aria-hidden="true">
        <span className="gauge__band" style={{ left: at(from), width: `calc(${at(to)} - ${at(from)})` }} />
        <span className="gauge__tick" style={{ left: at(mid) }} />
      </div>
      <dl className="gauge__legend">
        {[
          [labels[0], low],
          [labels[1], mid],
          [labels[2], high],
        ].map(([label, value]) => (
          <div key={label as string}>
            <dt>{label}</dt>
            <dd>
              {(value as number).toLocaleString("en-US")} {unit}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Label and value rows, hairline between. Reuses the spec table look from the editor's OBS fields. */
export function Facts({ rows }: { rows: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="spec__rows facts">
      {rows.map((row) => (
        <div className="spec__row" key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A small captioned table: the what-if rows, and the matches-by-mode rows. First column left, last right. */
export function MiniTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: Array<{ key: string; cells: ReactNode[]; current?: boolean }>;
}) {
  return (
    <table className="mini">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {head.map((label) => (
            <th key={label} scope="col">
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} data-current={row.current ? "true" : undefined}>
            {row.cells.map((cell, i) => (
              <td key={i}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
