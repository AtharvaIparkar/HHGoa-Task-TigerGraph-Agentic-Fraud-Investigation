import React, { useState, useRef, useMemo } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Crosshair,
  CreditCard,
  User,
  Smartphone,
  ShieldAlert,
  ArrowRight,
  X,
  FileText
} from "lucide-react";

export interface GraphNode {
  id: string;
  label: string;
  type: "transaction" | "customer" | "card" | "device" | "location" | "ring_card" | "prior_case";
  status?: string;
  details?: Record<string, any>;
  x?: number;
  y?: number;
}

export interface GraphLink {
  id: string;
  source: string;
  target: string;
  type: string;
  weight?: number;
  is_primary?: boolean;
}

interface InvestigationGraphProps {
  nodes: GraphNode[];
  links: GraphLink[];
  highlightedNodeIds?: string[];
  onNodeSelect?: (node: GraphNode | null) => void;
  selectedNodeId?: string | null;
  className?: string;
}

export const InvestigationGraph: React.FC<InvestigationGraphProps> = ({
  nodes: inputNodes,
  links: inputLinks,
  highlightedNodeIds = [],
  onNodeSelect,
  selectedNodeId,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(selectedNodeId || null);

  const activeSelectedId = selectedNodeId !== undefined ? selectedNodeId : internalSelectedId;

  // Clean, structured layout with spacious horizontal flow
  const layout = useMemo(() => {
    const width = 860;
    const height = 440;
    const cx = width / 2;
    const cy = height / 2;

    const positioned = inputNodes.map((n) => {
      let x = cx;
      let y = cy;

      switch (n.type) {
        case "transaction":
          x = cx;
          y = cy - 10;
          break;
        case "card":
          x = cx - 240;
          y = cy - 80;
          break;
        case "customer":
          x = cx - 260;
          y = cy + 70;
          break;
        case "device":
          x = cx + 240;
          y = cy - 80;
          break;
        case "ring_card":
          x = cx + 250;
          y = cy + 70;
          break;
        case "prior_case":
          x = cx;
          y = cy + 130;
          break;
        case "location":
          x = cx + 180;
          y = cy + 120;
          break;
        default:
          x = cx + (Math.random() - 0.5) * 200;
          y = cy + (Math.random() - 0.5) * 150;
      }

      return { ...n, x, y };
    });

    const nodeMap = new Map(positioned.map((n) => [n.id, n]));

    const computedLinks = inputLinks.map((l) => ({
      ...l,
      sourceNode: nodeMap.get(l.source),
      targetNode: nodeMap.get(l.target),
    }));

    return { nodes: positioned, links: computedLinks, width, height };
  }, [inputNodes, inputLinks]);

  const selectedNode = useMemo(() => {
    return layout.nodes.find((n) => n.id === activeSelectedId) || null;
  }, [layout.nodes, activeSelectedId]);

  // Pan interactions
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.min(Math.max(0.6, prev + delta), 2.0));
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setInternalSelectedId(null);
    if (onNodeSelect) onNodeSelect(null);
  };

  const handleCenter = () => {
    setZoom(1.1);
    setPan({ x: 0, y: 0 });
  };

  const isNodeHighlighted = (nodeId: string) => {
    if (highlightedNodeIds.length > 0) {
      return highlightedNodeIds.some((h) => nodeId.toLowerCase().includes(h.toLowerCase()));
    }
    return false;
  };

  const isDimmed = (nodeId: string) => {
    const focusId = hoveredNodeId || activeSelectedId;
    if (highlightedNodeIds.length > 0) {
      return !isNodeHighlighted(nodeId);
    }
    if (focusId) {
      if (nodeId === focusId) return false;
      const connected = layout.links.some(
        (l) =>
          (l.source === focusId && l.target === nodeId) ||
          (l.target === focusId && l.source === nodeId)
      );
      return !connected;
    }
    return false;
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-lg bg-[#0e0f13] border border-[#222329] overflow-hidden select-none ${className}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Sleek, minimal canvas controls */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-[#14151a]/90 backdrop-blur border border-[#26272e] rounded-md p-1 shadow-sm">
        <button
          onClick={() => handleZoom(0.15)}
          className="p-1 hover:bg-[#202128] text-zinc-400 hover:text-zinc-200 rounded transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => handleZoom(-0.15)}
          className="p-1 hover:bg-[#202128] text-zinc-400 hover:text-zinc-200 rounded transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-3.5 bg-[#26272e] mx-0.5" />
        <button
          onClick={handleCenter}
          className="p-1 hover:bg-[#202128] text-zinc-400 hover:text-zinc-200 rounded transition-colors"
          title="Recenter"
        >
          <Crosshair className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleReset}
          className="p-1 hover:bg-[#202128] text-zinc-400 hover:text-zinc-200 rounded transition-colors"
          title="Reset"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Subtle, classy legend */}
      <div className="absolute top-3 right-3 z-10 hidden sm:flex items-center gap-4 text-[11px] text-zinc-400 font-mono">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          Flagged Txn
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
          Entity
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          Cluster / Ring
        </span>
      </div>

      {/* SVG Canvas */}
      <svg
        className="w-full h-80 sm:h-96 cursor-grab active:cursor-grabbing"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Subtle connecting lines */}
          {layout.links.map((link) => {
            if (!link.sourceNode || !link.targetNode) return null;
            const x1 = link.sourceNode.x || 0;
            const y1 = link.sourceNode.y || 0;
            const x2 = link.targetNode.x || 0;
            const y2 = link.targetNode.y || 0;

            const isFocus =
              hoveredNodeId === link.source ||
              hoveredNodeId === link.target ||
              activeSelectedId === link.source ||
              activeSelectedId === link.target ||
              isNodeHighlighted(link.source) ||
              isNodeHighlighted(link.target);

            const dimmed = isDimmed(link.source) || isDimmed(link.target);

            // Clean curved path
            const dx = x2 - x1;
            const dy = y2 - y1;
            const cx1 = x1 + dx * 0.4;
            const cy1 = y1;
            const cx2 = x1 + dx * 0.6;
            const cy2 = y2;
            const pathD = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;

            return (
              <g key={link.id} opacity={dimmed ? 0.15 : isFocus ? 1 : 0.45}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={isFocus ? "#38bdf8" : link.type === "CONNECTED_RING" ? "#f59e0b" : "#3f3f46"}
                  strokeWidth={isFocus ? 1.8 : 1.2}
                  strokeDasharray={link.type === "CONNECTED_RING" ? "4 3" : "none"}
                />
              </g>
            );
          })}

          {/* Clean, classy node cards */}
          {layout.nodes.map((node) => {
            const x = node.x || 0;
            const y = node.y || 0;
            const isSelected = node.id === activeSelectedId;
            const isHovered = node.id === hoveredNodeId;
            const isHigh = isNodeHighlighted(node.id);
            const dimmed = isDimmed(node.id);
            const isTxn = node.type === "transaction";

            // Classy, compact card sizing
            const cardWidth = isTxn ? 150 : 130;
            const cardHeight = isTxn ? 52 : 44;

            return (
              <g
                key={node.id}
                transform={`translate(${x - cardWidth / 2}, ${y - cardHeight / 2})`}
                className="cursor-pointer"
                opacity={dimmed ? 0.2 : 1}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  setInternalSelectedId(node.id);
                  if (onNodeSelect) onNodeSelect(node);
                }}
              >
                {/* Clean card background */}
                <rect
                  width={cardWidth}
                  height={cardHeight}
                  rx="6"
                  fill={isTxn ? "#16171d" : "#121317"}
                  stroke={
                    isSelected
                      ? "#ffffff"
                      : isHigh
                      ? "#38bdf8"
                      : isHovered
                      ? "#52525b"
                      : isTxn
                      ? node.status === "flagged"
                        ? "#e11d48"
                        : "#27272a"
                      : "#222329"
                  }
                  strokeWidth={isSelected || isHigh ? 1.5 : 1}
                  className="transition-colors duration-150"
                />

                {/* Status indicator dot */}
                <circle
                  cx="12"
                  cy={cardHeight / 2}
                  r="3"
                  fill={
                    isTxn && node.status === "flagged"
                      ? "#f43f5e"
                      : node.type === "ring_card"
                      ? "#fbbf24"
                      : node.status === "compromised"
                      ? "#f43f5e"
                      : "#10b981"
                  }
                />

                {/* Primary Label */}
                <text
                  x="24"
                  y={isTxn ? 22 : 19}
                  fill="#fafafa"
                  fontSize={isTxn ? "11" : "10"}
                  fontWeight="600"
                  fontFamily="system-ui, sans-serif"
                >
                  {node.label}
                </text>

                {/* Secondary Type / Status Subtitle */}
                <text
                  x="24"
                  y={isTxn ? 37 : 33}
                  fill="#71717a"
                  fontSize="8.5"
                  fontFamily="monospace"
                >
                  {node.type.toUpperCase()}
                  {isTxn && node.details?.amount_usd
                    ? ` · $${Number(node.details.amount_usd).toFixed(2)}`
                    : ""}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Selected Node Details Drawer */}
      {selectedNode && (
        <div className="absolute bottom-3 right-3 z-20 w-72 bg-[#121317]/95 backdrop-blur border border-[#27272a] rounded-lg p-3 text-xs shadow-lg space-y-2">
          <div className="flex items-center justify-between border-b border-[#222329] pb-2">
            <span className="font-semibold text-zinc-100 font-mono text-[11px]">
              {selectedNode.label}
            </span>
            <button
              onClick={() => {
                setInternalSelectedId(null);
                if (onNodeSelect) onNodeSelect(null);
              }}
              className="text-zinc-500 hover:text-zinc-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1 text-zinc-400 font-mono text-[10px]">
            <div className="flex justify-between">
              <span>Entity ID:</span>
              <span className="text-zinc-200">{selectedNode.id}</span>
            </div>
            <div className="flex justify-between">
              <span>Type:</span>
              <span className="text-zinc-200 uppercase">{selectedNode.type}</span>
            </div>
            {selectedNode.details &&
              Object.entries(selectedNode.details).map(([k, v]) => (
                <div key={k} className="flex justify-between pt-0.5 border-t border-[#1c1d22]">
                  <span className="text-zinc-500">{k}:</span>
                  <span className="text-zinc-200 truncate max-w-[130px]" title={String(v)}>
                    {typeof v === "number" ? v.toFixed(2) : String(v)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
