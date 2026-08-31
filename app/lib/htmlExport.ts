import {
  connectorEndpoints,
  type CanvasDocument,
  type CanvasObject,
  type TextAlign,
  type TextVerticalAlign,
} from "./model";
import { processShapePaths, processShapeTextInsets } from "./processShapes";

export const CANVAS_HTML_MIME_TYPE = "text/html";

export type CanvasHtmlExport = {
  contents: string;
  fileName: string;
  mimeType: typeof CANVAS_HTML_MIME_TYPE;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fileSlug(title: string) {
  return title
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "canvas";
}

function rotatedBounds(object: CanvasObject) {
  const angle = (object.rotation * Math.PI) / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const points = [
    [0, 0],
    [object.width, 0],
    [object.width, object.height],
    [0, object.height],
  ].map(([x, y]) => ({
    x: object.x + x * cosine - y * sine,
    y: object.y + x * sine + y * cosine,
  }));
  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

function canvasViewBox(objects: CanvasObject[]) {
  if (objects.length === 0) return { x: 0, y: 0, width: 1200, height: 800 };
  const bounds = objects.map(rotatedBounds);
  const padding = 80;
  const minX = Math.min(...bounds.map((item) => item.minX)) - padding;
  const minY = Math.min(...bounds.map((item) => item.minY)) - padding;
  const maxX = Math.max(...bounds.map((item) => item.maxX)) + padding;
  const maxY = Math.max(...bounds.map((item) => item.maxY)) + padding;
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

function textBlock(
  object: CanvasObject,
  bounds: { x: number; y: number; width: number; height: number },
  text = object.text,
  className = "object-text",
) {
  const horizontal: TextAlign = object.textAlign ?? (object.kind === "sticky" || object.kind === "text" ? "left" : "center");
  const vertical: TextVerticalAlign = object.textVerticalAlign ?? (object.kind === "sticky" || object.kind === "text" ? "top" : "middle");
  return `<foreignObject x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}"><div xmlns="http://www.w3.org/1999/xhtml" class="${className} align-${horizontal} valign-${vertical}" style="font-size:${object.fontSize ?? (object.kind === "sticky" ? 17 : 16)}px">${escapeHtml(text)}</div></foreignObject>`;
}

function cardContent(object: CanvasObject, link = false) {
  const [title, ...body] = object.text.split("\n");
  const kicker = link ? "LINK ↗" : "CARD";
  const href = link && object.url
    ? ` href="${escapeHtml(object.url)}" target="_blank" rel="noopener noreferrer"`
    : "";
  const wrapper = link ? "a" : "g";
  return `<${wrapper}${href}>
    <rect class="object-body card-body" width="${object.width}" height="${object.height}" rx="16" fill="${escapeHtml(object.fill)}" stroke="${escapeHtml(object.stroke)}"/>
    <foreignObject x="18" y="15" width="${Math.max(24, object.width - 36)}" height="${Math.max(24, object.height - 28)}"><div xmlns="http://www.w3.org/1999/xhtml" class="card-content"><span>${kicker}</span><strong>${escapeHtml(title || (link ? "Link" : "Card"))}</strong><p>${escapeHtml(body.join("\n") || (link ? object.url ?? "" : ""))}</p></div></foreignObject>
  </${wrapper}>`;
}

function renderObject(object: CanvasObject) {
  const transform = `translate(${object.x} ${object.y}) rotate(${object.rotation})`;
  const fill = escapeHtml(object.fill);
  const stroke = escapeHtml(object.stroke);
  let content = "";

  if (object.kind === "text") {
    content = textBlock(object, { x: 0, y: 0, width: object.width, height: object.height });
  } else if (object.kind === "ellipse") {
    content = `<ellipse class="object-body" cx="${object.width / 2}" cy="${object.height / 2}" rx="${object.width / 2}" ry="${object.height / 2}" fill="${fill}" stroke="${stroke}"/>${textBlock(object, { x: 16, y: 12, width: Math.max(24, object.width - 32), height: Math.max(24, object.height - 24) })}`;
  } else if (object.kind === "process-shape" && object.processShape) {
    const paths = processShapePaths(object.processShape, object.width, object.height);
    const textBounds = processShapeTextInsets(object.processShape, object.width, object.height);
    content = `<path class="object-body" d="${paths.body}" fill="${fill}" stroke="${stroke}"/>${paths.detail ? `<path class="shape-detail" d="${paths.detail}" stroke="${stroke}"/>` : ""}${textBlock(object, textBounds)}`;
  } else if (object.kind === "sticky") {
    content = `<rect class="object-body sticky-body" width="${object.width}" height="${object.height}" rx="6" fill="${fill}" stroke="${stroke}"/><path class="sticky-fold" d="M ${object.width - 20} 0 L ${object.width} 20 L ${object.width} 0 Z"/>${textBlock(object, { x: 16, y: 14, width: Math.max(24, object.width - 32), height: Math.max(24, object.height - 28) })}`;
  } else if (object.kind === "image" && object.imageSrc) {
    content = `<rect class="object-body" width="${object.width}" height="${object.height}" rx="8" fill="#fff" stroke="${stroke}"/><image href="${escapeHtml(object.imageSrc)}" width="${object.width}" height="${object.height}" preserveAspectRatio="xMidYMid meet"/>`;
  } else if (object.kind === "link") {
    content = cardContent(object, true);
  } else if (object.kind === "rich-card") {
    content = cardContent(object);
  } else if (object.kind === "gcp-service") {
    content = `<rect class="object-body service-body" width="${object.width}" height="${object.height}" rx="12" fill="${fill}" stroke="${stroke}"/><path class="service-cloud" d="M ${object.width / 2 - 25} 58 C ${object.width / 2 - 31} 42, ${object.width / 2 - 8} 31, ${object.width / 2 + 2} 45 C ${object.width / 2 + 20} 35, ${object.width / 2 + 36} 58, ${object.width / 2 + 19} 68 H ${object.width / 2 - 20} C ${object.width / 2 - 34} 68, ${object.width / 2 - 36} 60, ${object.width / 2 - 25} 58 Z"/><foreignObject x="8" y="8" width="${Math.max(24, object.width - 16)}" height="18"><div xmlns="http://www.w3.org/1999/xhtml" class="service-kicker">GOOGLE CLOUD</div></foreignObject>${textBlock(object, { x: 10, y: Math.max(72, object.height - 44), width: Math.max(24, object.width - 20), height: 36 }, object.text, "object-text service-label")}`;
  } else {
    content = `<rect class="object-body" width="${object.width}" height="${object.height}" rx="16" fill="${fill}" stroke="${stroke}"/>${textBlock(object, { x: 16, y: 14, width: Math.max(24, object.width - 32), height: Math.max(24, object.height - 28) })}`;
  }

  return `<g class="canvas-object kind-${object.kind}" transform="${transform}">${content}</g>`;
}

function renderConnectors(document: CanvasDocument) {
  const objects = new Map(document.objects.map((object) => [object.id, object]));
  return document.connectors.flatMap((connector, index) => {
    const from = objects.get(connector.fromId);
    const to = objects.get(connector.toId);
    if (!from || !to) return [];
    const [start, end] = connectorEndpoints(from, to);
    const color = escapeHtml(connector.color);
    return [`<defs><marker id="arrow-${index}" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="${color}"/></marker></defs><path class="connector" d="M ${start.x} ${start.y} L ${end.x} ${end.y}" stroke="${color}" marker-end="url(#arrow-${index})"/>`];
  }).join("\n");
}

export function createCanvasHtmlExport(document: CanvasDocument): CanvasHtmlExport {
  const initial = canvasViewBox(document.objects);
  const initialViewBox = `${initial.x} ${initial.y} ${initial.width} ${initial.height}`;
  const title = escapeHtml(document.title || "Untitled canvas");
  const objects = document.objects.map(renderObject).join("\n");
  const connectors = renderConnectors(document);
  const contents = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title} — opengorky canvas</title>
  <style>
    :root{color-scheme:light;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#20222a;background:#f8f8f5}*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden}body{display:grid;grid-template-rows:56px 1fr}.topbar{z-index:2;display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid #dedfe4;padding:0 16px;background:rgba(255,255,255,.96)}.brand{display:flex;align-items:center;gap:9px;min-width:0}.mark{width:30px;height:30px;display:grid;place-items:center;border-radius:9px;background:#20222a;color:#fff;font-size:11px;font-weight:800}.title{overflow:hidden;font-size:13px;font-weight:700;text-overflow:ellipsis;white-space:nowrap}.controls{display:flex;gap:5px}.controls button{height:30px;border:1px solid #dedfe4;border-radius:7px;padding:0 10px;background:#fff;color:#20222a;font:600 11px inherit;cursor:pointer}.controls button:hover{background:#eef0ff;border-color:#cfd2ff}.viewport{position:relative;min-height:0;background:#f8f8f5}.viewport::before{content:"";position:absolute;inset:0;background-image:radial-gradient(circle,#cfd0d5 1px,transparent 1px);background-size:24px 24px;opacity:.65;pointer-events:none}svg{position:absolute;inset:0;width:100%;height:100%;cursor:grab;touch-action:none}svg.dragging{cursor:grabbing}.object-body{stroke-width:2;filter:drop-shadow(0 3px 5px rgba(31,34,43,.06))}.sticky-body{stroke-width:1.5;filter:drop-shadow(0 6px 6px rgba(31,34,43,.11))}.sticky-fold{fill:rgba(255,255,255,.35)}.shape-detail{fill:none;stroke-width:2}.connector{fill:none;stroke-width:2.5;stroke-linecap:round}.object-text{width:100%;height:100%;display:flex;overflow:hidden;color:#20222a;font-weight:650;line-height:1.35;white-space:pre-wrap;overflow-wrap:anywhere}.align-left{text-align:left;align-items:flex-start}.align-center{text-align:center;align-items:center}.align-right{text-align:right;align-items:flex-end}.valign-top{justify-content:flex-start}.valign-middle{justify-content:center}.valign-bottom{justify-content:flex-end}.card-body{filter:drop-shadow(0 7px 9px rgba(31,34,43,.1))}.card-content{width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden;color:#20222a}.card-content span,.service-kicker{color:#5f67d8;font:700 9px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em}.card-content strong{margin-top:11px;font-size:20px;line-height:1.05}.card-content p{overflow:hidden;margin:6px 0 0;color:#6e7280;font-size:12px;line-height:1.45;white-space:pre-wrap}.kind-link a{cursor:pointer}.kind-link a:hover .card-body{stroke:#5f67d8;stroke-width:2.5}.service-cloud{fill:#eef0ff;stroke:#5f67d8;stroke-width:2}.service-kicker{text-align:center;color:#80868b}.service-label{font-size:13px!important} .empty{font-size:24px;fill:#6e7280;text-anchor:middle}
  </style>
</head>
<body>
  <header class="topbar"><div class="brand"><span class="mark">og</span><span class="title">${title}</span></div><div class="controls"><button id="zoom-out" type="button" aria-label="Zoom out">−</button><button id="fit" type="button">Fit all</button><button id="zoom-in" type="button" aria-label="Zoom in">+</button></div></header>
  <main class="viewport"><svg id="canvas" role="img" aria-label="${title}" viewBox="${initialViewBox}" preserveAspectRatio="xMidYMid meet"><g id="scene">${connectors}${objects || `<text class="empty" x="600" y="400">Empty canvas</text>`}</g></svg></main>
  <script>
    (()=>{const svg=document.getElementById("canvas");const initial=[${initial.x},${initial.y},${initial.width},${initial.height}];let box=[...initial],drag=null;const apply=()=>svg.setAttribute("viewBox",box.join(" "));const zoom=(factor,cx=.5,cy=.5)=>{const nw=box[2]*factor,nh=box[3]*factor;box=[box[0]+(box[2]-nw)*cx,box[1]+(box[3]-nh)*cy,nw,nh];apply()};document.getElementById("fit").addEventListener("click",()=>{box=[...initial];apply()});document.getElementById("zoom-in").addEventListener("click",()=>zoom(.8));document.getElementById("zoom-out").addEventListener("click",()=>zoom(1.25));svg.addEventListener("wheel",event=>{event.preventDefault();const rect=svg.getBoundingClientRect();zoom(event.deltaY < 0 ? .9 : 1.1,(event.clientX-rect.left)/rect.width,(event.clientY-rect.top)/rect.height)},{passive:false});svg.addEventListener("pointerdown",event=>{if(event.button!==0)return;svg.setPointerCapture(event.pointerId);drag={x:event.clientX,y:event.clientY,box:[...box]};svg.classList.add("dragging")});svg.addEventListener("pointermove",event=>{if(!drag)return;const rect=svg.getBoundingClientRect();box[0]=drag.box[0]-(event.clientX-drag.x)*drag.box[2]/rect.width;box[1]=drag.box[1]-(event.clientY-drag.y)*drag.box[3]/rect.height;apply()});const end=()=>{drag=null;svg.classList.remove("dragging")};svg.addEventListener("pointerup",end);svg.addEventListener("pointercancel",end)})();
  </script>
</body>
</html>`;

  return {
    contents,
    fileName: `${fileSlug(document.title)}.canvas.html`,
    mimeType: CANVAS_HTML_MIME_TYPE,
  };
}
