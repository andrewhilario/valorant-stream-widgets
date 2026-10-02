"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ControlView } from "../controls/ControlView";
import { usePlayground } from "./usePlayground";

export function Inspector() {
  const pg = usePlayground();
  const { widget, config, activeTab, setActiveTab, advancedOpen, setAdvancedOpen } = pg;
  const sections = widget.schema.sections;
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const section = sections.find((s) => s.id === activeTab) ?? sections[0];
  const visible = (c: (typeof section.controls)[number]) => !c.showWhen || c.showWhen(config);
  const basic = section.controls.filter((c) => !c.advanced && visible(c));
  const advanced = section.controls.filter((c) => c.advanced && visible(c));

  const lookup = {
    status: pg.preview.status,
    account: pg.preview.account,
    tier: pg.preview.tier,
    configured: pg.configured,
    sample: pg.sample,
  };

  // Tab indicator: one thin bar that slides under the active tab (transform only).
  // It only animates after the first placement, so it doesn't sweep in on page load.
  const [bar, setBar] = useState({ x: 0, w: 0 });
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const tab = tabRefs.current[section.id];
    if (!tab) return;
    const place = () => setBar({ x: tab.offsetLeft, w: tab.offsetWidth });
    place();
    const frame = requestAnimationFrame(() => setAnimated(true));
    const observer = new ResizeObserver(place);
    observer.observe(tab);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [section.id]);

  const onKeyDown = (event: KeyboardEvent) => {
    const index = sections.findIndex((s) => s.id === section.id);
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % sections.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + sections.length) % sections.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = sections.length - 1;
    else return;
    event.preventDefault();
    setActiveTab(sections[next].id);
    tabRefs.current[sections[next].id]?.focus();
  };

  return (
    <aside className="inspector" aria-label="Widget settings">
      <div className="tabs" role="tablist" aria-label="Setting groups" onKeyDown={onKeyDown}>
        {sections.map((s) => (
          <button
            key={s.id}
            ref={(el) => {
              tabRefs.current[s.id] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${s.id}`}
            className="tab"
            aria-selected={s.id === section.id}
            aria-controls={`panel-${s.id}`}
            tabIndex={s.id === section.id ? 0 : -1}
            onClick={() => setActiveTab(s.id)}
          >
            {s.label}
          </button>
        ))}
        <span
          className="tabs__bar"
          aria-hidden="true"
          data-animated={animated}
          style={{ transform: `translateX(${bar.x}px) scaleX(${bar.w})` }}
        />
      </div>

      <div className="panel" role="tabpanel" id={`panel-${section.id}`} aria-labelledby={`tab-${section.id}`} tabIndex={0}>
        {basic.map((control) => (
          <ControlView key={control.key} control={control} config={config} onChange={pg.set} onTry={pg.tryChoice} lookup={lookup} />
        ))}

        {advanced.length > 0 && (
          <details
            className="advanced"
            open={Boolean(advancedOpen[section.id])}
            onToggle={(event) => {
              const open = event.currentTarget.open;
              setAdvancedOpen((prev) => (prev[section.id] === open ? prev : { ...prev, [section.id]: open }));
            }}
          >
            <summary>Advanced</summary>
            <div className="advanced__body">
              {advanced.map((control) => (
                <ControlView key={control.key} control={control} config={config} onChange={pg.set} onTry={pg.tryChoice} lookup={lookup} />
              ))}
            </div>
          </details>
        )}

        <div className="panel__foot">
          <button type="button" className="linkbtn" onClick={pg.reset}>
            Reset look and layout
          </button>
        </div>
      </div>
    </aside>
  );
}
