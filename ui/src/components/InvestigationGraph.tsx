import React, { useState, useRef, useMemo } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Crosshair,
  X,
  CreditCard,
  User,
  Smartphone,
  AlertTriangle,
  History,
  FileCheck
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

  // Spatial layout
  const layout = useMemo(() => {
    const width = 900;
    const height = 460;
    const cx = width / 2;
    const cy = height / 2;

    const positioned = inputNodes.map((n) => {
      let x = cx;
      let y = cy;

      switch (n.type) {
        case "transaction":
          x = cx;
          y = cy - 15;
          break;
        case "card":
          x = cx - 250;
          y = cy - 85;
          break;
        case "customer":
          x = cx - 270;
          y = cy + 75;
          break;
        case "device":
          x = cx + 250;
          y = cy - 85;
          break;
        case "ring_card":
          x = cx + 260;
          y = cy + 75;
          break;
        case "prior_case":
          x = cx;
          y = cy + 135;
          break;
        case "location":
          x = cx + 180;
          y = cy + 130;
          break;
        default:
          x = cx + (Math.random() - 0.5) * 220;
          y = cy + (Math.random() - 0.5) * 160;
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

  // Pan controls
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
    setZoom(1.05);
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

  const getNodeTheme = (node: GraphNode) => {
    switch (node.type) {
      case "transaction":
        return {
          accent: node.status === "flagged" ? "#e11d48" : "#2563eb",
          bg: "#ffffff",
          badgeBg: node.status === "flagged" ? "#ffe4e6" : "#dbeafe",
          badgeText: node.status === "flagged" ? "#be123c" : "#1e40af",
        };
      case "customer":
        return {
          accent: "#0284c7",
          bg: "#ffffff",
          badgeBg: "#e0f2fe",
          badgeText: "#0369a1",
        };
      case "card":
        return {
          accent: node.status === "compromised" ? "#e11d48" : "#0d9488",
          bg: "#ffffff",
          badgeBg: node.status === "compromised" ? "#ffe4e6" : "#ccfbf1",
          badgeText: node.status === "compromised" ? "#be123c" : "#0f766e",
        };
      case "device":
        return {
          accent: "#7c3aed",
          bg: "#ffffff",
          badgeBg: "#ede9fe",
          badgeText: "#6d28d9",
        };
      case "ring_card":
        return {
          accent: "#d97706",
          bg: "#ffffff",
          badgeBg: "#fef3c7",
          badgeText: "#b45309",
        };
      case "prior_case":
        return {
          accent: "#ca8a04",
          bg: "#ffffff",
          badgeBg: "#fef9c3",
          badgeText: "#a16207",
        };
      default:
        return {
          accent: "#64748b",
          bg: "#ffffff",
          badgeBg: "#f1f5f9",
          badgeText: "#475569",
        };
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-xl bg-white border border-slate-200/90 shadow-sm overflow-hidden select-none ${className}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Light subtle grid pattern */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
        <defs>
          <pattern id="light-grid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="#cbd5e1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#light-grid)" />
      </svg>

      {/* Floating Canvas Toolbar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-white/95 backdrop-blur border border-slate-200 rounded-lg p-1 shadow-sm">
        <button
          onClick={() => handleZoom(0.15)}
          className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => handleZoom(-0.15)}
          className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-3.5 bg-slate-200 mx-0.5" />
        <button
          onClick={handleCenter}
          className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded transition-colors"
          title="Center on flagged transaction"
        >
          <Crosshair className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleReset}
          className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded transition-colors"
          title="Reset zoom & pan"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Elegant Light Legend */}
      <div className="absolute top-3 right-3 z-10 hidden sm:flex items-center gap-3 bg-white/90 backdrop-blur border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-600 shadow-sm">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
          Flagged Txn
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-sky-500"></span>
          Customer / Card
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          Ring Syndicate
        </span>
      </div>

      {/* Main SVG Graphic */}
      <svg
        className="w-full h-80 sm:h-96 cursor-grab active:cursor-grabbing"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
      >
        <defs>
          <filter id="card-shadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.06" floodColor="#0f172a" />
          </filter>
          <filter id="card-shadow-active" x="-15%" y="-15%" width="130%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.12" floodColor="#0f172a" />
          </filter>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Curved connecting edges */}
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

            const dx = x2 - x1;
            const dy = y2 - y1;
            const cx1 = x1 + dx * 0.45;
            const cy1 = y1;
            const cx2 = x1 + dx * 0.55;
            const cy2 = y2;
            const pathD = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;

            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;

            return (
              <g key={link.id} opacity={dimmed ? 0.15 : isFocus ? 1 : 0.65}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={
                    isFocus
                      ? "#2563eb"
                      : link.type === "CONNECTED_RING"
                      ? "#f59e0b"
                      : "#cbd5e1"
                  }
                  strokeWidth={isFocus ? 2.2 : 1.5}
                  strokeDasharray={link.type === "CONNECTED_RING" ? "4 3" : "none"}
                />

                {/* Quiet link label pill */}
                {isFocus && (
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x="-32"
                      y="-8"
                      width="64"
                      height="16"
                      rx="8"
                      fill="#ffffff"
                      stroke="#e2e8f0"
                      strokeWidth="1"
                    />
                    <text
                      y="3.5"
                      textAnchor="middle"
                      fill="#475569"
                      fontSize="8"
                      fontFamily="monospace"
                      fontWeight="600"
                    >
                      {link.type}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Node Cards */}
          {layout.nodes.map((node) => {
            const x = node.x || 0;
            const y = node.y || 0;
            const isSelected = node.id === activeSelectedId;
            const isHovered = node.id === hoveredNodeId;
            const isHigh = isNodeHighlighted(node.id);
            const dimmed = isDimmed(node.id);
            const isTxn = node.type === "transaction";
            const theme = getNodeTheme(node);

            const cardWidth = isTxn ? 164 : 144;
            const cardHeight = isTxn ? 56 : 48;

            return (
              <g
                key={node.id}
                transform={`translate(${x - cardWidth / 2}, ${y - cardHeight / 2})`}
                className="cursor-pointer"
                opacity={dimmed ? 0.2 : 1}
                filter={isSelected || isHigh ? "url(#card-shadow-active)" : "url(#card-shadow)"}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  setInternalSelectedId(node.id);
                  if (onNodeSelect) onNodeSelect(node);
                }}
              >
                {/* Main card background */}
                <rect
                  width={cardWidth}
                  height={cardHeight}
                  rx="8"
                  fill="#ffffff"
                  stroke={
                    isSelected
                      ? "#2563eb"
                      : isHigh
                      ? "#0284c7"
                      : isHovered
                      ? "#94a3b8"
                      : "#e2e8f0"
                  }
                  strokeWidth={isSelected || isHigh ? 2 : 1}
                  className="transition-colors duration-150"
                />

                {/* Left accent color indicator bar */}
                <rect
                  x="0"
                  y="0"
                  width="4.5"
                  height={cardHeight}
                  rx="2"
                  fill={theme.accent}
                />

                {/* Node Title */}
                <text
                  x="14"
                  y={isTxn ? 23 : 20}
                  fill="#0f172a"
                  fontSize={isTxn ? "12" : "11"}
                  fontWeight="600"
                  fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
                >
                  {node.label}
                </text>

                {/* Secondary Pill Subtitle */}
                <rect
                  x="14"
                  y={isTxn ? 32 : 28}
                  width={isTxn && node.details?.amount_usd ? "90" : "72"}
                  height="14"
                  rx="4"
                  fill={theme.badgeBg}
                />
                <text
                  x="18"
                  y={isTxn ? 42.5 : 38.5}
                  fill={theme.badgeText}
                  fontSize="8.5"
                  fontWeight="600"
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
        <div className="absolute bottom-3 right-3 z-20 w-80 bg-white/95 backdrop-blur border border-slate-200 rounded-xl p-3.5 text-xs shadow-xl space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="font-semibold text-slate-900 font-mono text-xs">
              {selectedNode.label}
            </span>
            <button
              onClick={() => {
                setInternalSelectedId(null);
                if (onNodeSelect) onNodeSelect(null);
              }}
              className="text-slate-400 hover:text-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1.5 text-slate-600 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Entity ID:</span>
              <span className="text-slate-900 font-medium">{selectedNode.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Category:</span>
              <span className="text-slate-900 uppercase font-medium">{selectedNode.type}</span>
            </div>
            {selectedNode.details &&
              Object.entries(selectedNode.details).map(([k, v]) => (
                <div key={k} className="flex justify-between pt-1 border-t border-slate-100">
                  <span className="text-slate-400 capitalize">{k.replace(/_/g, " ")}:</span>
                  <span className="text-slate-900 truncate max-w-[140px]" title={String(v)}>
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
