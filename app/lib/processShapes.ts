export const PROCESS_SHAPE_KINDS = [
  "process",
  "decision",
  "terminator",
  "data",
  "document",
  "database",
  "predefined-process",
  "manual-operation",
] as const;

export type ProcessShapeKind = (typeof PROCESS_SHAPE_KINDS)[number];

export type ProcessShapeDefinition = {
  kind: ProcessShapeKind;
  label: string;
  defaultText: string;
  width: number;
  height: number;
};

export const PROCESS_SHAPES: ProcessShapeDefinition[] = [
  { kind: "process", label: "Process", defaultText: "Process", width: 190, height: 100 },
  { kind: "decision", label: "Decision", defaultText: "Decision?", width: 180, height: 130 },
  { kind: "terminator", label: "Start / End", defaultText: "Start / End", width: 180, height: 90 },
  { kind: "data", label: "Input / Output", defaultText: "Input / Output", width: 190, height: 100 },
  { kind: "document", label: "Document", defaultText: "Document", width: 180, height: 120 },
  { kind: "database", label: "Database", defaultText: "Database", width: 170, height: 125 },
  { kind: "predefined-process", label: "Predefined process", defaultText: "Subprocess", width: 200, height: 100 },
  { kind: "manual-operation", label: "Manual operation", defaultText: "Manual operation", width: 190, height: 105 },
];

export function isProcessShapeKind(value: unknown): value is ProcessShapeKind {
  return typeof value === "string" && PROCESS_SHAPE_KINDS.includes(value as ProcessShapeKind);
}

export function processShapePaths(kind: ProcessShapeKind, width: number, height: number) {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const radius = Math.min(16, w / 4, h / 4);
  const capsuleRadius = Math.min(w / 2, h / 2);
  const skew = Math.min(28, w * 0.16);
  const databaseLip = Math.min(18, h * 0.18);
  const sideInset = Math.min(24, w * 0.14);

  switch (kind) {
    case "decision":
      return { body: `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`, detail: "" };
    case "terminator":
      return {
        body: `M ${capsuleRadius} 0 H ${w - capsuleRadius} A ${capsuleRadius} ${capsuleRadius} 0 0 1 ${w - capsuleRadius} ${h} H ${capsuleRadius} A ${capsuleRadius} ${capsuleRadius} 0 0 1 ${capsuleRadius} 0 Z`,
        detail: "",
      };
    case "data":
      return { body: `M ${skew} 0 H ${w} L ${w - skew} ${h} H 0 Z`, detail: "" };
    case "document": {
      const waveTop = h * 0.82;
      return {
        body: `M 0 0 H ${w} V ${waveTop} C ${w * 0.72} ${h * 0.66}, ${w * 0.38} ${h * 1.04}, 0 ${h * 0.86} Z`,
        detail: "",
      };
    }
    case "database":
      return {
        body: `M 0 ${databaseLip} C 0 0, ${w} 0, ${w} ${databaseLip} V ${h - databaseLip} C ${w} ${h}, 0 ${h}, 0 ${h - databaseLip} Z`,
        detail: `M 0 ${databaseLip} C 0 ${databaseLip * 2}, ${w} ${databaseLip * 2}, ${w} ${databaseLip}`,
      };
    case "predefined-process":
      return {
        body: `M ${radius} 0 H ${w - radius} Q ${w} 0 ${w} ${radius} V ${h - radius} Q ${w} ${h} ${w - radius} ${h} H ${radius} Q 0 ${h} 0 ${h - radius} V ${radius} Q 0 0 ${radius} 0 Z`,
        detail: `M ${sideInset} 0 V ${h} M ${w - sideInset} 0 V ${h}`,
      };
    case "manual-operation":
      return { body: `M 0 0 H ${w} L ${w - sideInset} ${h} H ${sideInset} Z`, detail: "" };
    case "process":
    default:
      return {
        body: `M ${radius} 0 H ${w - radius} Q ${w} 0 ${w} ${radius} V ${h - radius} Q ${w} ${h} ${w - radius} ${h} H ${radius} Q 0 ${h} 0 ${h - radius} V ${radius} Q 0 0 ${radius} 0 Z`,
        detail: "",
      };
  }
}

export function processShapeTextInsets(kind: ProcessShapeKind, width: number, height: number) {
  switch (kind) {
    case "decision":
      return { x: width * 0.22, y: height * 0.18, width: width * 0.56, height: height * 0.64 };
    case "data":
      return { x: width * 0.16, y: 12, width: width * 0.68, height: Math.max(24, height - 24) };
    case "document":
      return { x: 16, y: 10, width: Math.max(24, width - 32), height: Math.max(24, height * 0.7) };
    case "database":
      return { x: 16, y: height * 0.18, width: Math.max(24, width - 32), height: Math.max(24, height * 0.65) };
    case "predefined-process":
      return { x: Math.min(34, width * 0.18), y: 12, width: Math.max(24, width - Math.min(68, width * 0.36)), height: Math.max(24, height - 24) };
    case "manual-operation":
      return { x: width * 0.16, y: 12, width: width * 0.68, height: Math.max(24, height - 24) };
    default:
      return { x: 16, y: 12, width: Math.max(24, width - 32), height: Math.max(24, height - 24) };
  }
}
