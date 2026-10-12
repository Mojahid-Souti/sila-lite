"use client";

import type { SilaCanvasDef } from "@/lib/sila-socket";
import { cn } from "@/lib/utils";
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  Handle,
  MarkerType,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowRight,
  Bot,
  type LucideIcon,
  Mail,
  MessageCircle,
  MessageSquare,
  Search,
  Wrench,
} from "lucide-react";
import { useMemo } from "react";

// n8n node type → a friendly icon, gradient, and label. No n8n chrome ever.
// The gradient (rather than a flat fill) is what keeps an icon tile from
// reading as a coloured square on a frosted card.
const NODE_META: Record<string, { icon: LucideIcon; from: string; to: string; label: string }> = {
  "n8n-nodes-base.webhook": {
    icon: MessageCircle,
    from: "from-blue-500",
    to: "to-blue-600",
    label: "Trigger",
  },
  "n8n-nodes-base.httpRequest": {
    icon: Search,
    from: "from-violet-500",
    to: "to-violet-600",
    label: "Retrieve knowledge",
  },
  "@n8n/n8n-nodes-langchain.lmChatOllama": {
    icon: Bot,
    from: "from-orange-400",
    to: "to-orange-600",
    label: "Model",
  },
  "n8n-nodes-base.respondToWebhook": {
    icon: ArrowRight,
    from: "from-neutral-600",
    to: "to-neutral-800",
    label: "Respond",
  },
  "n8n-nodes-base.emailSend": {
    icon: Mail,
    from: "from-rose-500",
    to: "to-rose-600",
    label: "Send email",
  },
  "n8n-nodes-base.slack": {
    icon: MessageSquare,
    from: "from-emerald-500",
    to: "to-emerald-600",
    label: "Post to Slack",
  },
};

const FALLBACK = {
  icon: Wrench,
  from: "from-neutral-400",
  to: "to-neutral-600",
  label: "Step",
};

const metaFor = (type: string) => NODE_META[type] ?? FALLBACK;

type NodeData = { title: string; subtitle: string; type: string; step: number };

/**
 * A frosted step card. Handles are invisible + non-interactive (edges still
 * attach, but there are no editable connection dots).
 *
 * The step NUMBER is the point of the badge: a workflow is an ordered thing,
 * and reading order off bezier curves alone is guesswork the moment the graph
 * is wider than three nodes.
 */
function FlowNode({ data }: NodeProps<Node<NodeData>>) {
  const meta = metaFor(data.type);
  const Icon = meta.icon;
  return (
    <div className="group relative flex w-64 items-center gap-3 rounded-2xl border border-white/70 bg-white/75 px-3 py-3 shadow-[0_8px_24px_-10px_rgba(15,23,42,0.35)] ring-1 ring-black/5 backdrop-blur-xl backdrop-saturate-150 transition-shadow hover:shadow-[0_12px_32px_-10px_rgba(15,23,42,0.45)]">
      <Handle type="target" position={Position.Top} isConnectable={false} className="!opacity-0" />
      <span
        className="-top-2 -left-2 absolute grid size-5 place-items-center rounded-full border border-white bg-white font-semibold text-[10px] text-neutral-500 shadow-sm tabular-nums"
        aria-hidden
      >
        {data.step}
      </span>
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-sm",
          meta.from,
          meta.to
        )}
      >
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium text-[13px] text-neutral-900">
          {data.title}
        </span>
        <span className="block truncate text-[11px] text-neutral-400">{data.subtitle}</span>
      </span>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        className="!opacity-0"
      />
    </div>
  );
}

const NODE_TYPES = { flow: FlowNode };

// A compact column, laid out here rather than taken from the definition.
// n8n's own coordinates spread a four-step flow over ~1100px; inside a chat
// bubble fitView answered that by zooming to ~0.45, which made every card
// unreadable. A column fits the panel's aspect, so the cards render at full
// size and the reading order is the obvious one.
const ROW_HEIGHT = 92;

function toGraph(def: SilaCanvasDef): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const raw = def.nodes ?? [];
  const nodes: Node<NodeData>[] = raw.map((n, i) => ({
    id: n.name,
    type: "flow",
    position: { x: 0, y: i * ROW_HEIGHT },
    data: { title: n.name, subtitle: metaFor(n.type).label, type: n.type, step: i + 1 },
    draggable: false,
    selectable: false,
  }));
  const edges: Edge[] = [];
  for (const [source, conn] of Object.entries(def.connections ?? {})) {
    for (const target of conn.main?.[0] ?? []) {
      edges.push({
        id: `${source}->${target.node}`,
        source,
        target: target.node,
        type: "smoothstep",
        animated: true,
        style: { stroke: "#94a3b8", strokeWidth: 1.75 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8", width: 16, height: 16 },
      });
    }
  }
  return { nodes, edges };
}

/** The node kinds actually present, in first-appearance order — a legend of
 *  every type is noise when a workflow uses three of them. */
function Legend({ types }: { types: string[] }) {
  if (types.length === 0) return null;
  return (
    <div className="pointer-events-none absolute top-2.5 left-2.5 z-10 flex max-w-[calc(100%-1.25rem)] flex-wrap gap-1.5 rounded-2xl border border-white/60 bg-white/70 p-1.5 shadow-lg backdrop-blur-xl backdrop-saturate-150">
      {types.map((type) => {
        const meta = metaFor(type);
        return (
          <span key={type} className="flex items-center gap-1.5 rounded-full px-1.5 py-0.5">
            <span
              className={cn("size-2 shrink-0 rounded-full bg-gradient-to-br", meta.from, meta.to)}
            />
            <span className="text-[11px] text-neutral-600">{meta.label}</span>
          </span>
        );
      })}
    </div>
  );
}

/**
 * Read-only build canvas — renders the workflow DEFINITION (nodes + connections
 * JSON) that SILA produced, as a clean node graph. It never mounts the n8n
 * editor: no iframe, no Execute/Publish, no edit handles. Pan + zoom only; the
 * workflow stays inactive on the backend, so this view can't trigger anything.
 */
export function SilaBuildCanvas({ definition }: { definition?: SilaCanvasDef }) {
  const graph = useMemo(
    () => (definition?.nodes?.length ? toGraph(definition) : null),
    [definition]
  );
  const types = useMemo(() => {
    const seen = new Set<string>();
    for (const node of definition?.nodes ?? []) seen.add(node.type);
    return [...seen];
  }, [definition]);

  if (!graph) {
    return (
      <div className="grid h-[420px] place-items-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-400 text-sm">
        The workflow draft isn't available to preview.
      </div>
    );
  }
  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-br from-slate-50 via-white to-blue-50/40 shadow-sm">
      <Legend types={types} />
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        edgesFocusable={false}
        panOnDrag
        zoomOnScroll
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color="#cbd5e1" />
        {/* Zoom in / out only (read-only — no interactive lock, no fit button). The
            frosted legend above is pointer-events-none, so these stay clickable. */}
        <Controls
          showInteractive={false}
          showFitView={false}
          position="bottom-right"
          className="!shadow-lg overflow-hidden rounded-xl border border-white/60 bg-white/70 backdrop-blur-xl backdrop-saturate-150 [&>button:hover]:bg-white [&>button]:border-white/50 [&>button]:bg-transparent [&>button]:text-neutral-500"
        />
      </ReactFlow>
    </div>
  );
}
