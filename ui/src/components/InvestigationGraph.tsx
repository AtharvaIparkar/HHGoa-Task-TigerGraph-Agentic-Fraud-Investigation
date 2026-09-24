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
  Play,
  Pause,
  Filter,
  Layers,
  Sparkles,
  GitBranch,
  Radio,
  Share2
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

type LayoutMode = "flow" | "radial" | "cluster";

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
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("flow");
  const [filterType, setFilterType] = useState<string>("all");
  const [isFlowAnimated, setIsFlowAnimated] = useState(true);

  const activeSelectedId = selectedNodeId !== undefined ? selectedNodeId : internalSelectedId;

  // Compute positions based on dynamic layoutMode
  const layout = useMemo(() => {
    const width = 940;
    const height = 480;
    const cx = width / 2;
    const cy = height / 2;

    const positioned = inputNodes.map((n) => {
      let x = cx;
      let y = cy;

      if (layoutMode === "flow") {
        // Sequential Lineage Flow (Left-to-Right)
        switch (n.type) {
          case "customer":
            x = cx - 320;
            y = cy + 20;
            break;
          case "card":
            x = cx - 140;
            y = cy - 60;
            break;
          case "transaction":
            x = cx + 50;
            y = cy - 20;
            break;
          case "device":
            x = cx + 240;
            y = cy - 80;
            break;
          case "ring_card":
            x = cx + 270;
            y = cy + 70;
            break;
          case "prior_case":
            x = cx - 120;
            y = cy + 120;
            break;
          case "location":
            x = cx + 180;
            y = cy + 125;
            break;
          default:
            x = cx + (Math.random() - 0.5) * 200;
            y = cy + (Math.random() - 0.5) * 150;
        }
      } else if (layoutMode === "radial") {
        // Radial Nexus (Orbiting the central transaction)
        if (n.type === "transaction") {
          x = cx;
          y = cy;
        } else {
          const satellites = inputNodes.filter((i) => i.type !== "transaction");
          const index = satellites.findIndex((s) => s.id === n.id);
          const total = Math.max(satellites.length, 1);
          const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
          const radius = 190;
          x = cx + Math.cos(angle) * radius;
          y = cy + Math.sin(angle) * (radius * 0.85);
        }
      } else {
        // Topology Cluster
        switch (n.type) {
          case "transaction":
            x = cx - 40;
            y = cy - 40;
            break;
          case "customer":
            x = cx - 240;
            y = cy + 40;
            break;
          case "card":
            x = cx - 120;
            y = cy - 130;
            break;
          case "device":
            x = cx + 160;
            y = cy - 90;
            break;
          case "ring_card":
            x = cx + 220;
            y = cy + 60;
            break;
          case "prior_case":
            x = cx + 20;
            y = cy + 140;
            break;
          default:
            x = cx + (Math.random() - 0.5) * 200;
            y = cy + (Math.random() - 0.5) * 150;
        }
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
  }, [inputNodes, inputLinks, layoutMode]);

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
    setZoom(1.05);
    setPan({ x: 0, y: 0 });
  };

  const isNodeHighlighted = (nodeId: string) => {
    if (highlightedNodeIds.length > 0) {
      return highlightedNodeIds.some((h) => nodeId.toLowerCase().includes(h.toLowerCase()));
    }
    return false;
  };

  const isNodeVisible = (node: GraphNode) => {
    if (filterType === "all") return true;
    return node.type === filterType;
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
          badgeBg: node.status === "flagged" ? "#ffe4e6" : "#dbeafe",
          badgeText: node.status === "flagged" ? "#be123c" : "#1e40af",
        };
      case "customer":
        return {
          accent: "#0284c7",
          badgeBg: "#e0f2fe",
          badgeText: "#0369a1",
        };
      case "card":
        return {
          accent: node.status === "compromised" ? "#e11d48" : "#0d9488",
          badgeBg: node.status === "compromised" ? "#ffe4e6" : "#ccfbf1",
          badgeText: node.status === "compromised" ? "#be123c" : "#0f766e",
        };
      case "device":
        return {
          accent: "#7c3aed",
          badgeBg: "#ede9fe",
          badgeText: "#6d28d9",
        };
      case "ring_card":
        return {
          accent: "#d97706",
          badgeBg: "#fef3c7",
          badgeText: "#b45309",
        };
      case "prior_case":
        return {
          accent: "#ca8a04",
          badgeBg: "#fef9c3",
          badgeText: "#a16207",
        };
      default:
        return {
          accent: "#64748b",
          badgeBg: "#f1f5f9",
          badgeText: "#475569",
        };
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-sm overflow-hidden select-none transition-all ${className}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* ── Top Modular Toolbar ─────────────────────────────────────── */}
      <div className="absolute top-2 sm:top-3 left-2 sm:left-3 right-2 sm:right-auto z-10 flex flex-wrap items-center justify-between sm:justify-start gap-1.5 sm:gap-2">
        {/* Canvas Zoom & Center controls */}
        <div className="flex items-center gap-0.5 sm:gap-1 bg-white/95 backdrop-blur border border-slate-200/90 rounded-xl p-0.5 sm:p-1 shadow-sm">
          <button
            onClick={() => handleZoom(0.15)}
            className="p-1 sm:p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleZoom(-0.15)}
            className="p-1 sm:p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-3.5 bg-slate-200 mx-0.5" />
          <button
            onClick={handleCenter}
            className="p-1 sm:p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-colors"
            title="Recenter Canvas"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleReset}
            className="p-1 sm:p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-colors"
            title="Reset View"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Dynamic Layout Mode Selector */}
        <div className="flex items-center bg-white/95 backdrop-blur border border-slate-200/90 rounded-xl p-0.5 sm:p-1 shadow-sm font-mono text-[10px] sm:text-[11px]">
          <button
            onClick={() => setLayoutMode("flow")}
            className={`px-2 sm:px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 sm:gap-1.5 font-medium ${
              layoutMode === "flow"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <GitBranch className="w-3 h-3" />
            <span className="hidden xs:inline">Lineage</span>
            <span className="xs:hidden">Line</span>
          </button>
          <button
            onClick={() => setLayoutMode("radial")}
            className={`px-2 sm:px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 sm:gap-1.5 font-medium ${
              layoutMode === "radial"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Radio className="w-3 h-3" />
            <span>Radial</span>
          </button>
          <button
            onClick={() => setLayoutMode("cluster")}
            className={`px-2 sm:px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 sm:gap-1.5 font-medium ${
              layoutMode === "cluster"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Share2 className="w-3 h-3" />
            <span className="hidden xs:inline">Clusters</span>
            <span className="xs:hidden">Clust</span>
          </button>
        </div>

        {/* Flow Animation Toggle */}
        <button
          onClick={() => setIsFlowAnimated(!isFlowAnimated)}
          className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl border text-[10px] sm:text-[11px] font-mono flex items-center gap-1 sm:gap-1.5 shadow-sm transition-all ${
            isFlowAnimated
              ? "bg-blue-50 border-blue-200 text-blue-700 font-semibold"
              : "bg-white border-slate-200 text-slate-500"
          }`}
          title="Toggle live telemetry pulse animation"
        >
          <Sparkles className="w-3 h-3" />
          <span>{isFlowAnimated ? "Pulses: ON" : "Pulses: OFF"}</span>
        </button>
      </div>

      {/* ── Top-Right Entity Filters ─────────────────────────────────── */}
      <div className="absolute top-3 right-3 z-10 hidden md:flex items-center gap-1 bg-white/95 backdrop-blur border border-slate-200/90 rounded-xl p-1 shadow-sm font-mono text-[10px]">
        {["all", "transaction", "card", "device", "ring_card"].map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-2 py-0.5 rounded-lg capitalize transition-colors ${
              filterType === t
                ? "bg-slate-100 font-bold text-slate-900"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t === "all" ? "All Entities" : t.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {/* ── Main SVG Canvas ─────────────────────────────────────────── */}
      <svg
        className="w-full h-84 sm:h-96 cursor-grab active:cursor-grabbing touch-none"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
      >
        <defs>
          <pattern id="light-dots-canvas" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.2" fill="#cbd5e1" />
          </pattern>

          <filter id="float-shadow" x="-15%" y="-15%" width="130%" height="135%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity="0.07" floodColor="#0f172a" />
          </filter>
          <filter id="float-shadow-active" x="-20%" y="-20%" width="140%" height="145%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodOpacity="0.16" floodColor="#2563eb" />
          </filter>
        </defs>

        {/* Ambient Grid */}
        <rect width="100%" height="100%" fill="url(#light-dots-canvas)" opacity="0.35" />

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Animated Connecting Edge Lines */}
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
                {/* Background base path */}
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
                  strokeWidth={isFocus ? 2.5 : 1.5}
                  strokeDasharray={link.type === "CONNECTED_RING" ? "4 3" : "none"}
                />

                {/* Animated data flow pulse line */}
                {isFlowAnimated && (isFocus || link.is_primary) && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke={link.type === "CONNECTED_RING" ? "#d97706" : "#3b82f6"}
                    strokeWidth={isFocus ? 2.8 : 2}
                    className="animate-edge-flow"
                    opacity="0.85"
                  />
                )}

                {/* Quiet Floating Label Pill */}
                {isFocus && (
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x="-34"
                      y="-9"
                      width="68"
                      height="18"
                      rx="9"
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

          {/* Interactive Node Cards */}
          {layout.nodes.map((node) => {
            const x = node.x || 0;
            const y = node.y || 0;
            const isSelected = node.id === activeSelectedId;
            const isHovered = node.id === hoveredNodeId;
            const isHigh = isNodeHighlighted(node.id);
            const dimmed = isDimmed(node.id);
            const isTxn = node.type === "transaction";
            const theme = getNodeTheme(node);

            const cardWidth = isTxn ? 168 : 148;
            const cardHeight = isTxn ? 58 : 50;

            if (!isNodeVisible(node)) return null;

            return (
              <g
                key={node.id}
                transform={`translate(${x - cardWidth / 2}, ${y - cardHeight / 2})`}
                className="cursor-pointer transition-all duration-300"
                opacity={dimmed ? 0.25 : 1}
                filter={isSelected || isHigh ? "url(#float-shadow-active)" : "url(#float-shadow)"}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  setInternalSelectedId(node.id);
                  if (onNodeSelect) onNodeSelect(node);
                }}
              >
                {/* Radar ripple wave for flagged/highlighted nodes */}
                {(isHigh || (isTxn && node.status === "flagged")) && (
                  <rect
                    x="-6"
                    y="-6"
                    width={cardWidth + 12}
                    height={cardHeight + 12}
                    rx="14"
                    fill="none"
                    stroke={isTxn ? "#f43f5e" : "#3b82f6"}
                    strokeWidth="1.5"
                    className="animate-radar pointer-events-none"
                  />
                )}

                {/* Main Card Shape */}
                <rect
                  width={cardWidth}
                  height={cardHeight}
                  rx="10"
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

                {/* Left accent bar */}
                <rect
                  x="0"
                  y="0"
                  width="5"
                  height={cardHeight}
                  rx="2.5"
                  fill={theme.accent}
                />

                {/* Node Title */}
                <text
                  x="15"
                  y={isTxn ? 24 : 21}
                  fill="#0f172a"
                  fontSize={isTxn ? "12" : "11"}
                  fontWeight="600"
                  fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
                >
                  {node.label}
                </text>

                {/* Node Subtitle Pill */}
                <rect
                  x="15"
                  y={isTxn ? 34 : 29}
                  width={isTxn && node.details?.amount_usd ? "92" : "74"}
                  height="15"
                  rx="4.5"
                  fill={theme.badgeBg}
                />
                <text
                  x="20"
                  y={isTxn ? 45 : 40}
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

      {/* ── Modular Node Inspector Drawer ────────────────────────────── */}
      {selectedNode && (
        <div className="absolute bottom-3 right-3 z-20 w-80 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-4 text-xs shadow-xl space-y-3 font-mono animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <span className="font-bold text-slate-900 text-xs">
                {selectedNode.label}
              </span>
            </div>
            <button
              onClick={() => {
                setInternalSelectedId(null);
                if (onNodeSelect) onNodeSelect(null);
              }}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1.5 text-slate-600 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Entity ID:</span>
              <span className="text-slate-900 font-semibold">{selectedNode.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Topology Type:</span>
              <span className="text-slate-900 uppercase font-semibold">{selectedNode.type}</span>
            </div>
            {selectedNode.status && (
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="text-emerald-700 font-bold uppercase">{selectedNode.status}</span>
              </div>
            )}
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

          <div className="pt-1 text-[10px] text-slate-400 border-t border-slate-100 flex items-center justify-between">
            <span>Graph Connected Neighbors</span>
            <span className="font-bold text-blue-600">
              {
                layout.links.filter(
                  (l) => l.source === selectedNode.id || l.target === selectedNode.id
                ).length
              }{" "}
              edges
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
