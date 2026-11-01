"use client";

import { useMemo, useState } from "react";

type Shape = { id: string; label: string; kind: string; x: number; y: number; width: number; height: number; row: number; col: number };
type Edge = { id: string; source: string; target: string };

const SAMPLE = `Page: Dashboard
  Header: "Acme Analytics" [full-width]
  Nav: "Overview" | "Reports" | "Settings"
  Main:
    Card: "Total revenue" | "$48,290" | "+12.5%"
    Card: "Active users" | "2,840" | "+8.2%"
    Chart: "Revenue overview" (line chart)
    Table: "Recent transactions" [columns: Date, Customer, Amount, Status]
  Footer: "© 2024 Acme Inc."`;

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function parseAsciiDiagram(input: string): { shapes: Shape[]; edges: Edge[] } | null {
  const lines = input.split(/\r?\n/);
  const shapes: Shape[] = [];
  const boxPattern = /\+[-=]{3,}\+/g;
  for (let row = 0; row < lines.length; row += 1) {
    const line = lines[row];
    boxPattern.lastIndex = 0;
    let match = boxPattern.exec(line);
    while (match) {
      const top = match[0];
      const col = match.index;
      const endCol = col + top.length - 1;
      const nextLine = lines[row + 1] || "";
      const looksLikeBoxTop = nextLine[col] === "|" && nextLine[endCol] === "|";
      let bottomRow = -1;
      if (looksLikeBoxTop) {
        for (let candidate = row + 1; candidate < Math.min(lines.length, row + 14); candidate += 1) {
          const candidateLine = lines[candidate].slice(col, endCol + 1);
          if (candidateLine.match(/^\+[-=+]+\+$/)) { bottomRow = candidate; break; }
        }
      }
      if (bottomRow > row) {
        const content = lines.slice(row + 1, bottomRow)
          .map((contentLine) => contentLine.slice(col, endCol + 1).replace(/^\|\s?/, "").replace(/\s?\|$/, "").trim())
          .filter((value) => value && !/^[+|\-\s]+$/.test(value));
        const label = content.join(" · ") || "Element";
        const title = content[0] || "Element";
        shapes.push({ id: `shape-${shapes.length + 2}`, label, kind: title, x: 60 + col * 7, y: 50 + row * 28, width: Math.max(180, top.length * 7), height: Math.max(58, (bottomRow - row) * 22), row, col });
      }
      match = boxPattern.exec(line);
    }
  }
  if (shapes.length < 2) return null;
  const edges: Edge[] = [];
  for (const target of shapes) {
    const previous = shapes.filter((source) => source.row < target.row && target.row - source.row < 18).sort((a, b) => b.row - a.row);
    if (!previous.length) continue;
    const closestRow = previous[0].row;
    const candidates = previous.filter((source) => source.row === closestRow);
    const targetCenter = target.col + target.width / 7 / 2;
    const source = candidates.sort((a, b) => Math.abs((a.col + a.width / 7 / 2) - targetCenter) - Math.abs((b.col + b.width / 7 / 2) - targetCenter))[0];
    const between = lines.slice(source.row + 1, target.row).join(" ");
    const aligned = source && Math.abs((source.col + source.width / 7 / 2) - targetCenter) < 3;
    if (source && (aligned || /v|\|/.test(between))) edges.push({ id: `edge-${edges.length + 1}`, source: source.id, target: target.id });
  }
  return { shapes, edges };
}

function parseWireframe(input: string): { shapes: Shape[]; edges: Edge[] } {
  const ascii = parseAsciiDiagram(input);
  if (ascii) return ascii;
  const lines = input.split(/\r?\n/).filter((line) => line.trim());
  const shapes: Shape[] = [];
  const indentLevels = new Map<number, number>();
  let counter = 2;
  lines.forEach((line, index) => {
    const leading = line.match(/^\s*/)?.[0].length ?? 0;
    const depth = Math.floor(leading / 2);
    const raw = line.trim().replace(/^[-*]\s*/, "");
    const match = raw.match(/^([A-Za-z][\w -]*?)(?::|\s+-\s+)(.*)$/);
    const kind = (match?.[1] || raw.split(/\s+/)[0] || "Element").trim();
    const rest = (match?.[2] || raw.replace(kind, "")).trim().replace(/^[:\-]\s*/, "");
    const label = rest.replace(/\[.*?\]|\(.*?\)/g, "").replace(/[|]/g, " · ").replace(/"/g, "").trim() || kind;
    const x = 100 + depth * 54;
    const y = 90 + (indentLevels.get(depth) ?? 0) * 92;
    indentLevels.set(depth, (indentLevels.get(depth) ?? 0) + 1);
    for (const key of Array.from(indentLevels.keys())) if (key > depth) indentLevels.delete(key);
    const normalized = kind.toLowerCase();
    const width = normalized.includes("table") || normalized.includes("chart") ? 470 : normalized.includes("header") || normalized.includes("footer") ? 840 : 300;
    const height = normalized.includes("table") ? 175 : normalized.includes("chart") ? 220 : normalized.includes("nav") ? 65 : normalized.includes("header") || normalized.includes("footer") ? 60 : 82;
    shapes.push({ id: `shape-${counter++}`, label, kind, x, y: y + index * 4, width, height, row: index, col: depth });
  });
  return { shapes, edges: [] };
}

function buildXml(shapes: Shape[], edges: Edge[]) {
  const cells = shapes.map((shape) => {
    const style = shape.kind.toLowerCase().includes("chart") ? "shape=mxgraph.chart.line;html=1;rounded=0;fillColor=#fffdf8;strokeColor=#a7a19a;fontColor=#1e2622;" : shape.kind.toLowerCase().includes("header") ? "rounded=0;whiteSpace=wrap;html=1;fillColor=#26332c;strokeColor=#26332c;fontColor=#ffffff;fontStyle=1;" : shape.kind.toLowerCase().includes("footer") ? "rounded=0;whiteSpace=wrap;html=1;fillColor=#f0eee7;strokeColor=#d8d5cc;fontColor=#69716b;" : "rounded=1;whiteSpace=wrap;html=1;fillColor=#fffdf8;strokeColor=#c9c4b8;fontColor=#26332c;spacing=12;";
    return `<mxCell id="${shape.id}" value="${escapeXml(shape.label)}" style="${style}" vertex="1" parent="1"><mxGeometry x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" as="geometry"/></mxCell>`;
  }).join("");
  const connectors = edges.map((edge) => `<mxCell id="${edge.id}" value="" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#7d877f;endArrow=block;endFill=1;" edge="1" parent="1" source="${edge.source}" target="${edge.target}"><mxGeometry relative="1" as="geometry"/></mxCell>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="app.diagrams.net" agent="Wireframe to XML" version="24.7.17">\n  <diagram id="wireframe-1" name="Page-1">\n    <mxGraphModel dx="1422" dy="794" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">\n      <root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}${connectors}</root>\n    </mxGraphModel>\n  </diagram>\n</mxfile>`;
}

function Icon({ children }: { children: React.ReactNode }) { return <span className="icon" aria-hidden="true">{children}</span>; }

export default function Home() {
  const [input, setInput] = useState(SAMPLE);
  const [convertedInput, setConvertedInput] = useState(SAMPLE);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const diagram = useMemo(() => parseWireframe(convertedInput), [convertedInput]);
  const shapes = diagram.shapes;
  const xml = useMemo(() => buildXml(shapes, diagram.edges), [diagram, shapes]);
  const hasInput = input.trim().length > 0;
  const download = () => { if (!convertedInput.trim()) return; const blob = new Blob([xml], { type: "application/xml;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "wireframe.drawio.xml"; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); };
  const copy = async () => {
    if (!convertedInput.trim()) return;
    try { await navigator.clipboard.writeText(xml); setCopied(true); setCopyError(false); window.setTimeout(() => setCopied(false), 1800); }
    catch { setCopyError(true); window.setTimeout(() => setCopyError(false), 2400); }
  };
  const clear = () => { setInput(""); setConvertedInput(""); setCopied(false); setCopyError(false); };
  return <main className="shell">
    <header className="topbar"><div className="brand"><span className="brand-mark"><i></i><i></i><i></i></span><span>wireframe <b>→</b> xml</span></div><div className="header-actions"><span className="local-pill"><span className="status-dot"></span> Runs locally</span><a className="github" href="https://github.com" target="_blank" rel="noreferrer"><Icon>◈</Icon> GitHub</a></div></header>
    <section className="hero"><div className="eyebrow"><span>✦</span> AI wireframes, polished</div><h1>From plain text<br /><em>to a polished diagram.</em></h1><p>Paste the wireframe your AI generated. Get a draw.io-ready file in seconds.</p></section>
    <section className="workspace">
      <div className="panel input-panel"><div className="panel-head"><div><div className="panel-kicker"><span className="step">01</span> INPUT</div><h2>Paste your wireframe</h2></div><div className="input-actions"><button className="ghost-button" onClick={() => setInput(SAMPLE)} disabled={input === SAMPLE}>Load example</button><button className="ghost-button" onClick={clear} disabled={!input && !convertedInput}><Icon>⌫</Icon> Clear</button></div></div><textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder={'Page: Sign in\n  Header: "Welcome back"\n  Form:\n    Input: Email address\n    Input: Password\n    Button: Continue'} spellCheck={false} aria-label="Wireframe input"/><div className="panel-foot"><span><kbd>⌘</kbd> + <kbd>V</kbd> to paste</span><button className="mobile-convert" onClick={() => { setConvertedInput(input); setCopied(false); }} disabled={!hasInput}>Convert to XML <span aria-hidden="true">→</span></button><span>{input.length} characters</span></div></div>
      <div className="convert-column"><div className="convert-line"></div><button className="convert-icon" onClick={() => { setConvertedInput(input); setCopied(false); }} disabled={!hasInput} aria-label="Convert wireframe to XML">→</button><span>CONVERT</span></div>
      <div className="panel output-panel"><div className="panel-head"><div><div className="panel-kicker"><span className="step">02</span> OUTPUT</div><h2>Ready for draw.io</h2></div><button className="ghost-button" onClick={copy} disabled={!convertedInput.trim()}><Icon>{copied ? "✓" : "▣"}</Icon> {copied ? "Copied" : copyError ? "Copy unavailable" : "Copy XML"}</button></div>{convertedInput.trim() ? <pre className="xml-preview" aria-label="Generated draw.io XML">{xml}</pre> : <div className="empty-preview"><span className="empty-icon">&lt;/&gt;</span><strong>Your XML will appear here</strong><span>Enter a wireframe, then select Convert.</span></div>}<div className="panel-foot output-foot"><span><span className="status-dot"></span> {convertedInput.trim() ? "XML generated" : "Waiting for input"}</span><span>{shapes.length} elements · {diagram.edges.length} connectors</span></div></div>
    </section>
    <section className="how"><div><div className="panel-kicker"><span className="step">03</span> NEXT STEP</div><h2>Take it to draw.io</h2><p>Download the XML and open it in draw.io. Everything is editable — move, style, and connect to make it yours.</p></div><button className="download-button" onClick={download} disabled={!convertedInput.trim()}><span>Download .drawio.xml</span><span className="download-arrow">↓</span></button></section>
    <footer><span>Built for the messy middle between AI ideas and clear diagrams.</span><span>Private by default · No data leaves your browser</span></footer>
  </main>;
}
