import { notFound } from "next/navigation";
import { WidgetRuntime } from "@/components/WidgetRuntime";
import { getWidget, widgets } from "@/widgets/registry";

// One static shell per widget: served from the CDN, no function call per OBS refresh.
// Settings come from the link's query string, read in the browser.

export function generateStaticParams() {
  return Object.keys(widgets).map((widget) => ({ widget }));
}

export default async function WidgetPage({ params }: { params: Promise<{ widget: string }> }) {
  const { widget } = await params;
  if (!getWidget(widget)) notFound();
  return <WidgetRuntime widgetId={widget} />;
}
