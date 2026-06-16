"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "base",
  themeVariables: {
    primaryColor: "#FFFFFF",
    primaryTextColor: "#1A202C",
    primaryBorderColor: "#2D5BFF",
    lineColor: "#4A5568",
    fontFamily: "Geist, ui-sans-serif, system-ui",
    fontSize: "14px",
    clusterBkg: "#F2F4F7",
    clusterBorder: "#E2E8F0",
    nodeBorder: "#2D5BFF",
    edgeLabelBackground: "#FFFFFF",
  },
  flowchart: {
    htmlLabels: true,
    curve: "basis",
  },
});

export function MermaidDiagram({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    let cancelled = false;
    (async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, chart);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (error) {
    return (
      <pre className="text-xs text-[var(--brand-magenta)] bg-[var(--brand-magenta)]/10 p-3 rounded-md whitespace-pre-wrap">
        {error}
      </pre>
    );
  }
  return <div ref={ref} className="w-full overflow-x-auto" />;
}
