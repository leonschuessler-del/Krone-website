"use client";

import { AlertTriangle, CheckCircle2, ClipboardCopy, Code2, Loader2, RotateCcw, Save, Shapes, Trash2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";
import { adminApi, describeApiError } from "../api-client";
import { Badge, Card, Notice } from "../ui";

type Pt = [number, number];
type Label = { x: number; y: number };

export interface MapEditorSpace {
  id: string;
  name: string;
  code: string;
  color: string;
  level: string;
  configPolygon: Pt[] | null;
  configLabel: Label | null;
  overridePolygon: Pt[] | null;
  overrideLabel: Label | null;
}

type Drag = { kind: "point"; index: number } | { kind: "label" } | { kind: "move"; start: Pt; orig: Pt[]; origLabel: Label | null };

const effective = (s: MapEditorSpace) => ({
  polygon: s.overridePolygon ?? s.configPolygon,
  label: s.overrideLabel ?? s.configLabel,
});

const centroid = (pts: Pt[]): Label => ({
  x: Math.round(pts.reduce((a, p) => a + p[0], 0) / pts.length),
  y: Math.round(pts.reduce((a, p) => a + p[1], 0) / pts.length),
});

export function toFloorplanSnippet(space: { id: string; level: string }, points: Pt[], label: Label): string {
  const rows: string[] = [];
  for (let i = 0; i < points.length; i += 6) {
    rows.push(`      ${points.slice(i, i + 6).map(([x, y]) => `[${x}, ${y}]`).join(", ")},`);
  }
  return [
    "  {",
    `    spaceId: "${space.id}",`,
    `    level: "${space.level}",`,
    "    polygon: [",
    ...rows,
    "    ],",
    `    labelPosition: { x: ${label.x}, y: ${label.y} },`,
    "  },",
  ].join("\n");
}

export function MapEditor({ spaces: initialSpaces, initialId, viewBox }: { spaces: MapEditorSpace[]; initialId: string; viewBox: { width: number; height: number } }) {
  const { width: W, height: H } = viewBox;
  const router = useRouter();
  const [spaces, setSpaces] = useState(initialSpaces);
  const [selectedId, setSelectedId] = useState(initialId);
  const space = spaces.find((s) => s.id === selectedId) ?? spaces[0]!;
  const base = effective(space);
  const [points, setPoints] = useState<Pt[] | null>(base.polygon ? base.polygon.map((p) => [...p] as Pt) : null);
  const [label, setLabel] = useState<Label | null>(base.label ? { ...base.label } : null);
  const [selPoint, setSelPoint] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [scale, setScale] = useState(1.4);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const dirty = useMemo(() => JSON.stringify(points) !== JSON.stringify(base.polygon) || JSON.stringify(label) !== JSON.stringify(base.label), [points, label, base.polygon, base.label]);

  // keep handle sizes constant on screen
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setScale(W / w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [W]);

  const load = useCallback((s: MapEditorSpace) => {
    const e = effective(s);
    setPoints(e.polygon ? e.polygon.map((p) => [...p] as Pt) : null);
    setLabel(e.label ? { ...e.label } : null);
    setSelPoint(null);
    setDrag(null);
    setMessage(null);
  }, []);

  function selectSpace(id: string) {
    if (id === selectedId) return;
    if (dirty && !window.confirm("Ungespeicherte Änderungen verwerfen?")) return;
    const next = spaces.find((s) => s.id === id);
    if (!next) return;
    setSelectedId(id);
    load(next);
    const url = new URL(window.location.href);
    url.searchParams.set("bereich", id);
    window.history.replaceState(null, "", url);
  }

  /** client (screen) coordinates → viewBox coordinates */
  const toSvg = useCallback(
    (clientX: number, clientY: number): Pt => {
      const svg = svgRef.current;
      const ctm = svg?.getScreenCTM();
      if (!svg || !ctm) return [0, 0];
      const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      return [Math.min(W, Math.max(0, Math.round(p.x))), Math.min(H, Math.max(0, Math.round(p.y)))];
    },
    [W, H],
  );

  const startDrag = (e: ReactPointerEvent, d: Drag) => {
    e.preventDefault();
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    setDrag(d);
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const p = toSvg(e.clientX, e.clientY);
    if (drag.kind === "point") {
      setPoints((cur) => (cur ? cur.map((q, i) => (i === drag.index ? p : q)) : cur));
    } else if (drag.kind === "label") {
      setLabel({ x: p[0], y: p[1] });
    } else {
      const dx = p[0] - drag.start[0];
      const dy = p[1] - drag.start[1];
      setPoints(drag.orig.map(([x, y]) => [Math.min(W, Math.max(0, x + dx)), Math.min(H, Math.max(0, y + dy))] as Pt));
      if (drag.origLabel) setLabel({ x: Math.min(W, Math.max(0, drag.origLabel.x + dx)), y: Math.min(H, Math.max(0, drag.origLabel.y + dy)) });
    }
  };

  const endDrag = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (drag && svgRef.current?.hasPointerCapture(e.pointerId)) svgRef.current.releasePointerCapture(e.pointerId);
    setDrag(null);
  };

  const insertAfter = (e: ReactPointerEvent, i: number) => {
    if (!points) return;
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const mid: Pt = [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2)];
    const next = [...points.slice(0, i + 1), mid, ...points.slice(i + 1)];
    setPoints(next);
    setSelPoint(i + 1);
    startDrag(e, { kind: "point", index: i + 1 });
  };

  const deletePoint = useCallback(() => {
    if (selPoint === null || !points || points.length <= 3) return;
    setPoints(points.filter((_, i) => i !== selPoint));
    setSelPoint(null);
  }, [selPoint, points]);

  // keyboard: Delete/Backspace removes the selected point, arrows nudge it
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (selPoint === null) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deletePoint();
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        setPoints((cur) => (cur ? cur.map((p, i) => (i === selPoint ? ([Math.min(W, Math.max(0, p[0] + dx)), Math.min(H, Math.max(0, p[1] + dy))] as Pt) : p)) : cur));
      } else if (e.key === "Escape") {
        setSelPoint(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selPoint, deletePoint, W, H]);

  function createShape() {
    const cx = Math.round(W / 2);
    const cy = Math.round(H / 2);
    const rect: Pt[] = [
      [cx - 80, cy - 60],
      [cx + 80, cy - 60],
      [cx + 80, cy + 60],
      [cx - 80, cy + 60],
    ];
    setPoints(rect);
    setLabel({ x: cx, y: cy });
    setSelPoint(null);
  }

  async function persist(polygon: Pt[] | null, labelPos: Label | null, successText: string) {
    setBusy(true);
    setMessage(null);
    const res = await adminApi(`/api/admin/spaces/${space.id}`, { method: "PATCH", body: { polygonOverride: polygon, labelPositionOverride: labelPos } });
    setBusy(false);
    if (!res.ok) {
      setMessage({ tone: "danger", text: describeApiError(res) });
      return;
    }
    const updated: MapEditorSpace = { ...space, overridePolygon: polygon, overrideLabel: labelPos };
    setSpaces((all) => all.map((s) => (s.id === space.id ? updated : s)));
    load(updated);
    setMessage({ tone: "success", text: successText });
    router.refresh();
  }

  function save() {
    if (!points || points.length < 3) return setMessage({ tone: "danger", text: "Eine Fläche braucht mindestens drei Punkte." });
    void persist(points, label ?? centroid(points), "Fläche gespeichert – die Website zeigt ab sofort die neue Form.");
  }

  function resetToConfig() {
    if (!window.confirm(`Die gespeicherte Anpassung für „${space.name}“ entfernen und wieder die Form aus der Konfiguration (floorplan.ts) verwenden?`)) return;
    void persist(null, null, "Auf die Konfiguration zurückgesetzt.");
  }

  const snippet = points && points.length >= 3 ? toFloorplanSnippet(space, points, label ?? centroid(points)) : "";
  const hasOverride = Boolean(space.overridePolygon || space.overrideLabel);
  const r = 7 * scale;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Bereich wählen">
          {spaces.map((s) => {
            const hasShape = Boolean(effective(s).polygon);
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={s.id === selectedId}
                onClick={() => selectSpace(s.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
                  s.id === selectedId ? "border-ink bg-ink text-paper" : "border-stone/70 bg-white text-ink-soft hover:border-ink/40",
                )}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
                {s.name}
                {!hasShape && <span className="text-[0.65rem] font-semibold uppercase tracking-wide opacity-70">(keine Fläche)</span>}
                {s.overridePolygon && <span className="h-1.5 w-1.5 rounded-full bg-gold-light" title="angepasst" />}
              </button>
            );
          })}
        </div>

        <div className="card-surface overflow-hidden p-2">
          <div className="relative aspect-[1536/1024] w-full select-none overflow-hidden rounded-xl bg-[#cfc9b8]" data-testid="map-editor">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/map/base.svg" alt="" width={W} height={H} draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              className={cn("absolute inset-0 h-full w-full touch-none", drag ? "cursor-grabbing" : "cursor-default")}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onPointerDown={() => setSelPoint(null)}
              role="application"
              aria-label={`Fläche von ${space.name} bearbeiten`}
            >
              {/* reference: other spaces */}
              {spaces
                .filter((s) => s.id !== space.id)
                .map((s) => {
                  const e = effective(s);
                  if (!e.polygon) return null;
                  return (
                    <g key={s.id} pointerEvents="none" opacity={0.75}>
                      <polygon points={e.polygon.map((p) => p.join(",")).join(" ")} fill={s.color} fillOpacity={0.12} stroke={s.color} strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
                      {e.label && (
                        <text x={e.label.x} y={e.label.y} textAnchor="middle" dominantBaseline="central" fontSize={14 * scale} fontWeight={700} fill="#fbf8f2" stroke="#1c1917" strokeWidth={3 * scale} paintOrder="stroke" fontFamily="Georgia, serif">
                          {s.code}
                        </text>
                      )}
                    </g>
                  );
                })}

              {points && (
                <g>
                  <polygon
                    points={points.map((p) => p.join(",")).join(" ")}
                    fill={space.color}
                    fillOpacity={0.38}
                    stroke="#f5e3b5"
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    className="cursor-move"
                    onPointerDown={(e) => {
                      setSelPoint(null);
                      startDrag(e, { kind: "move", start: toSvg(e.clientX, e.clientY), orig: points.map((p) => [...p] as Pt), origLabel: label });
                    }}
                  />
                  {/* edge midpoints: click/drag to insert a point */}
                  {points.map((p, i) => {
                    const q = points[(i + 1) % points.length]!;
                    const mx = (p[0] + q[0]) / 2;
                    const my = (p[1] + q[1]) / 2;
                    return (
                      <g key={`mid-${i}`} className="cursor-copy" onPointerDown={(e) => insertAfter(e, i)} data-testid="edge-midpoint">
                        <title>Punkt einfügen</title>
                        <circle cx={mx} cy={my} r={r * 0.8} fill="#1c1917" fillOpacity={0.55} stroke="#fff" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
                        <path d={`M${mx - r * 0.45} ${my}H${mx + r * 0.45}M${mx} ${my - r * 0.45}V${my + r * 0.45}`} stroke="#fff" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
                      </g>
                    );
                  })}
                  {/* vertices */}
                  {points.map((p, i) => (
                    <circle
                      key={`pt-${i}`}
                      cx={p[0]}
                      cy={p[1]}
                      r={selPoint === i ? r * 1.25 : r}
                      fill={selPoint === i ? "#b8904a" : "#fff"}
                      stroke={selPoint === i ? "#fff" : "#1c1917"}
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                      className="cursor-grab"
                      data-testid="vertex"
                      onPointerDown={(e) => {
                        setSelPoint(i);
                        startDrag(e, { kind: "point", index: i });
                      }}
                    >
                      <title>{`Punkt ${i + 1}: ${p[0]}, ${p[1]}`}</title>
                    </circle>
                  ))}
                </g>
              )}

              {label && (
                <g className="cursor-move" onPointerDown={(e) => startDrag(e, { kind: "label" })} data-testid="label-handle">
                  <title>Beschriftung verschieben</title>
                  <rect x={label.x - 22 * scale} y={label.y - 15 * scale} width={44 * scale} height={30 * scale} rx={15 * scale} fill="#1c1917" fillOpacity={0.92} stroke="#d8bb7e" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                  <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="central" fontSize={15 * scale} fontWeight={700} fill="#d8bb7e" fontFamily="Georgia, serif" pointerEvents="none">
                    {space.code}
                  </text>
                </g>
              )}
            </svg>

            {!points && (
              <div className="absolute inset-0 grid place-items-center bg-anthracite/35">
                <div className="max-w-sm rounded-2xl bg-paper p-6 text-center shadow-lift">
                  <Shapes className="mx-auto h-8 w-8 text-gold" />
                  <p className="mt-2 font-serif text-xl">Noch keine Fläche für „{space.name}“</p>
                  <p className="mt-1 text-sm text-muted">Legen Sie ein Rechteck an und ziehen Sie die Punkte an die richtige Stelle.</p>
                  <Button size="sm" className="mt-4" onClick={createShape} data-testid="create-shape">
                    Fläche anlegen
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4 xl:sticky xl:top-6">
        <Card
          title={
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: space.color }} />
              {space.name}
            </span>
          }
          description={hasOverride ? "Quelle: gespeicherte Anpassung (Datenbank)" : space.configPolygon ? "Quelle: Konfiguration (floorplan.ts)" : "Noch keine Fläche hinterlegt"}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5 text-xs">
              <Badge>{points ? `${points.length} Punkte` : "keine Fläche"}</Badge>
              {hasOverride && <Badge tone="info">angepasst</Badge>}
              {dirty && <Badge tone="warning">ungespeichert</Badge>}
              {selPoint !== null && points?.[selPoint] && (
                <Badge tone="gold">
                  Punkt {selPoint + 1}: {points[selPoint]![0]}, {points[selPoint]![1]}
                </Badge>
              )}
            </div>
            {message && (
              <Notice tone={message.tone} className="flex items-start gap-2">
                {message.tone === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                <span data-testid="map-message">{message.text}</span>
              </Notice>
            )}
            <Button className="w-full" onClick={save} disabled={busy || !dirty || !points} data-testid="save-map">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Speichern
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="sm" onClick={deletePoint} disabled={selPoint === null || !points || points.length <= 3} data-testid="delete-point">
                <Trash2 className="h-4 w-4" /> Punkt löschen
              </Button>
              <Button variant="secondary" size="sm" onClick={() => load(space)} disabled={!dirty || busy}>
                <Undo2 className="h-4 w-4" /> Verwerfen
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setExportOpen(true)} disabled={!snippet} data-testid="export-code">
                <Code2 className="h-4 w-4" /> Als Code
              </Button>
              <Button variant="secondary" size="sm" onClick={resetToConfig} disabled={!hasOverride || busy} title="Auf Konfiguration zurücksetzen">
                <RotateCcw className="h-4 w-4" /> Zurücksetzen
              </Button>
            </div>
            <p className="text-xs text-muted">„Zurücksetzen“ entfernt die gespeicherte Anpassung – es gilt wieder die Form aus der Konfiguration.</p>
          </div>
        </Card>

        <Card title="So funktioniert’s">
          <ul className="list-disc space-y-1.5 pl-4 text-sm text-ink-soft">
            <li>
              <strong>Punkte verschieben:</strong> weißen Punkt anfassen und ziehen.
            </li>
            <li>
              <strong>Punkt einfügen:</strong> auf ein <span className="inline-grid h-4 w-4 place-items-center rounded-full bg-anthracite/70 text-[0.65rem] text-white">+</span> in der Mitte einer Kante klicken (und ziehen).
            </li>
            <li>
              <strong>Punkt löschen:</strong> Punkt anklicken, dann <kbd className="rounded border border-stone bg-white px-1 text-xs">Entf</kbd> drücken oder „Punkt löschen“ (mind. 3 Punkte).
            </li>
            <li>
              <strong>Feinjustieren:</strong> Pfeiltasten (mit <kbd className="rounded border border-stone bg-white px-1 text-xs">Shift</kbd> 10er-Schritte).
            </li>
            <li>
              <strong>Ganze Fläche verschieben:</strong> in die Fläche klicken und ziehen.
            </li>
            <li>
              <strong>Beschriftung:</strong> das dunkle Kürzel-Schild ziehen.
            </li>
            <li>Gestrichelte Flächen zeigen die übrigen Bereiche zur Orientierung.</li>
          </ul>
        </Card>
      </div>

      <Dialog
        open={exportOpen}
        onClose={() => {
          setExportOpen(false);
          setCopied(false);
        }}
        title="Als Code exportieren"
        description="Diesen Eintrag in src/config/floorplan.ts (spaceShapes) für den Bereich ersetzen, um die Form dauerhaft in den Code zu übernehmen."
        size="lg"
        footer={
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(snippet);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              <ClipboardCopy className="h-4 w-4" /> {copied ? "Kopiert" : "Kopieren"}
            </Button>
          </div>
        }
      >
        <textarea readOnly value={snippet} rows={Math.min(20, snippet.split("\n").length + 1)} className="w-full resize-none rounded-xl border border-sand bg-anthracite p-4 font-mono text-[0.8rem] leading-relaxed text-gold-pale" onFocus={(e) => e.currentTarget.select()} data-testid="export-snippet" />
      </Dialog>
    </div>
  );
}
