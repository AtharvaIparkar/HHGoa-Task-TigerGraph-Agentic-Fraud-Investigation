import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Crosshair,
  Layers,
  Info,
  ShieldAlert,
  User,
  CreditCard,
  Smartphone,
  MapPin,
  Users,
  Archive,
  AlertOctagon,
  ArrowRight,
  X
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
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(selectedNodeId || null);

  const activeSelectedId = selectedNodeId !== undefined ? selectedNodeId : internalSelectedId;

  // Compute layout positions centered around the flagged transaction
  const layoutData = useMemo(() => {
    const width = 800;
    const height = 480;
    const cx = width / 2;
    const cy = height / 2;

    const positionedNodes = inputNodes.map((n) => {
      let x = cx;
      let y = cy;

      if (n.type === "transaction") {
        x = cx;
        y = cy;
      } else if (n.type === "customer") {
        x = cx - 220;
        y = cy + 40;
      } else if (n.type === "card") {
        x = cx - 180;
        y = cy - 110;
      } else if (n.type === "device") {
        x = cx + 210;
        y = cy - 90;
      } else if (n.type === "location") {
        x = cx + 140;
        y = cy + 130;
      } else if (n.type === "ring_card") {
        x = cx + 270;
        y = cy + 60;
      } else if (n.type === "prior_case") {
        x = cx - 80;
        y = cy + 150;
      } else {
        x = cx + (Math.random() - 0.5) * 300;
        y = cy + (Math.random() - 0.5) * 200;
      }

      return { ...n, x, y };
    });

    const nodeMap = new Map(positionedNodes.map((n) => [n.id, n]));

    const computedLinks = inputLinks.map((l) => {
      const sourceNode = nodeMap.get(l.source);
      const targetNode = nodeMap.get(l.target);
      return {
        ...l,
        sourceNode,
        targetNode,
      };
    });

    return { nodes: positionedNodes, links: computedLinks, width, height };
  }, [inputNodes, inputLinks]);

  const selectedNode = useMemo(() => {
    return layoutData.nodes.find((n) => n.id === activeSelectedId) || null;
  }, [layoutData.nodes, activeSelectedId]);

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.min(Math.max(0.4, prev + delta), 2.2));
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    if (onNodeSelect) onNodeSelect(null);
    setInternalSelectedId(null);
  };

  const handleFocusTransaction = () => {
    setZoom(1.2);
    setPan({ x: 0, y: 0 });
    const txn = layoutData.nodes.find((n) => n.type === "transaction");
    if (txn) {
      setInternalSelectedId(txn.id);
      if (onNodeSelect) onNodeSelect(txn);
    }
  };

  const handleNodeClick = (e: React.MouseEvent, node: GraphNode) => {
    e.stopPropagation();
    setInternalSelectedId(node.id);
    if (onNodeSelect) onNodeSelect(node);
  };

  const isHighlighted = (nodeId: string) => {
    if (highlightedNodeIds.length > 0) {
      return highlightedNodeIds.some((h) => nodeId.toLowerCase().includes(h.toLowerCase()));
    }
    return false;
  };

  const isNodeDimmed = (nodeId: string) => {
    if (highlightedNodeIds.length > 0) {
      return !isHighlighted(nodeId);
    }
    if (activeSelectedId) {
      if (nodeId === activeSelectedId) return false;
      const isConnected = layoutData.links.some(
        (l) =>
          (l.source === activeSelectedId && l.target === nodeId) ||
          (l.target === activeSelectedId && l.source === nodeId)
      );
      return !isConnected;
    }
    return false;
  };

  // Node visual attributes by type
  const getNodeStyle = (node: GraphNode) => {
    const selected = node.id === activeSelectedId;
    const highlighted = isHighlighted(node.id);
    const dimmed = isNodeDimmed(node.id);

    let fill = "#0f172a";
    let stroke = "#475569";
    let textFill = "#cbd5e1";
    let radius = 24;

    switch (node.type) {
      case "transaction":
        fill = node.status === "flagged" ? "#4c0519" : "#1e1b4b";
        stroke = node.status === "flagged" ? "#f43f5e" : "#818cf8";
        radius = 32;
        break;
      case "customer":
        fill = "#082f49";
        stroke = "#0ea5e9";
        radius = 24;
        break;
      case "card":
        fill = node.status === "compromised" ? "#450a0a" : "#0c4a6e";
        stroke = node.status === "compromised" ? "#ef4444" : "#38bdf8";
        radius = 24;
        break;
      case "device":
        fill = "#2e1065";
        stroke = "#a855f7";
        radius = 24;
        break;
      case "ring_card":
        fill = "#451a03";
        stroke = "#f59e0b";
        radius = 22;
        break;
      case "prior_case":
        fill = "#1c1917";
        stroke = "#eab308";
        radius = 22;
        break;
      default:
        fill = "#0f172a";
        stroke = "#64748b";
    }

    if (highlighted) {
      stroke = "#38bdf8";
    }
    if (selected) {
      stroke = "#ffffff";
    }

    return { fill, stroke, textFill, radius, opacity: dimmed ? 0.25 : 1 };
  };

  return (
    <div
      className={`relative w-full rounded-xl bg-slate-950 border border-slate-800/90 overflow-hidden select-none ${className}`}
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Background Dot Radar Grid */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
        <defs>
          <pattern id="grid-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="#475569" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-dots)" />
      </svg>

      {/* Floating Operational Toolbar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur border border-slate-800 p-1.5 rounded-lg shadow-lg">
        <button
          onClick={() => handleZoom(0.15)}
          className="p-1.5 hover:bg-slate-800 text-slate-300 rounded transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleZoom(-0.15)}
          className="p-1.5 hover:bg-slate-800 text-slate-300 rounded transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-slate-800 mx-0.5" />
        <button
          onClick={handleFocusTransaction}
          className="p-1.5 hover:bg-slate-800 text-cyan-400 rounded transition-colors flex items-center gap-1 text-xs font-mono"
          title="Center Flagged Transaction"
        >
          <Crosshair className="w-4 h-4" />
          <span className="hidden sm:inline">Center Txn</span>
        </button>
        <button
          onClick={handleReset}
          className="p-1.5 hover:bg-slate-800 text-slate-300 rounded transition-colors"
          title="Fit & Reset View"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Differentiator & Subgraph Legend */}
      <div className="absolute top-3 right-3 z-10 hidden sm:flex items-center gap-3 bg-slate-900/90 backdrop-blur border border-slate-800 px-3 py-1.5 rounded-lg text-[11px] text-slate-400 font-mono shadow-lg">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-500/20"></span>
          Flagged Txn
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
          Customer / Card
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
          Device / Fingerprint
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
          Syndicate Ring
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
          Precedent (Diff C)
        </span>
      </div>

      {/* SVG Canvas */}
      <svg
        className="w-full h-80 sm:h-96 cursor-grab active:cursor-grabbing"
        viewBox={`0 0 ${layoutData.width} ${layoutData.height}`}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Edge Links */}
          {layoutData.links.map((link) => {
            if (!link.sourceNode || !link.targetNode) return null;
            const x1 = link.sourceNode.x || 0;
            const y1 = link.sourceNode.y || 0;
            const x2 = link.targetNode.x || 0;
            const y2 = link.targetNode.y || 0;

            const isLinkHighlighted =
              isHighlighted(link.source) ||
              isHighlighted(link.target) ||
              (activeSelectedId && (link.source === activeSelectedId || link.target === activeSelectedId));

            const isDimmed =
              (highlightedNodeIds.length > 0 && !isLinkHighlighted) ||
              (activeSelectedId && !isLinkHighlighted);

            let strokeColor = "#334155";
            let strokeWidth = 1.5;
            let strokeDasharray = "none";

            if (link.type === "CONNECTED_RING") {
              strokeColor = "#f59e0b";
              strokeDasharray = "4 3";
              strokeWidth = 2;
            } else if (link.type === "SHARED_DEVICE_PROFILE") {
              strokeColor = "#a855f7";
              strokeDasharray = "3 2";
              strokeWidth = 2;
            } else if (link.type === "CASE_SIMILAR_TO") {
              strokeColor = "#eab308";
              strokeDasharray = "5 3";
              strokeWidth = 1.5;
            } else if (link.is_primary) {
              strokeColor = "#0ea5e9";
              strokeWidth = 2.2;
            }

            if (isLinkHighlighted) {
              strokeColor = "#38bdf8";
              strokeWidth = 2.5;
            }

            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;

            return (
              <g key={link.id} opacity={isDimmed ? 0.15 : 0.85}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                />
                {/* Edge Type Label */}
                <rect
                  x={midX - 28}
                  y={midY - 7}
                  width="56"
                  height="14"
                  rx="3"
                  fill="#0b0f19"
                  stroke="#1e293b"
                  strokeWidth="0.5"
                />
                <text
                  x={midX}
                  y={midY + 3}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="7"
                  fontFamily="monospace"
                  fontWeight="600"
                >
                  {link.type}
                </text>
              </g>
            );
          })}

          {/* Graph Nodes */}
          {layoutData.nodes.map((node) => {
            const style = getNodeStyle(node);
            const isSelected = node.id === activeSelectedId;
            const highlighted = isHighlighted(node.id);

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={(e) => handleNodeClick(e, node)}
                className="cursor-pointer transition-opacity duration-200"
                opacity={style.opacity}
              >
                {/* Pulsing ring for flagged or highlighted node */}
                {(highlighted || (node.type === "transaction" && node.status === "flagged")) && (
                  <circle
                    r={style.radius + 8}
                    fill="none"
                    stroke={node.type === "transaction" ? "#f43f5e" : "#38bdf8"}
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                    className="animate-spin"
                    style={{ animationDuration: "12s" }}
                  />
                )}

                {/* Node Outer Selection Glow */}
                {isSelected && (
                  <circle
                    r={style.radius + 5}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                  />
                )}

                {/* Main Node Body */}
                <circle
                  r={style.radius}
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth={isSelected ? 3 : 2}
                  className="shadow-xl"
                />

                {/* Node Icon Graphic */}
                {node.type === "transaction" && (
                  <text y="-4" textAnchor="middle" fill="#fecdd3" fontSize="11" fontWeight="bold">
                    $
                  </text>
                )}
                {node.type === "customer" && (
                  <text y="-3" textAnchor="middle" fill="#38bdf8" fontSize="10">
                    👤
                  </text>
                )}
                {node.type === "card" && (
                  <text y="-3" textAnchor="middle" fill="#67e8f9" fontSize="10">
                    💳
                  </text>
                )}
                {node.type === "device" && (
                  <text y="-3" textAnchor="middle" fill="#c084fc" fontSize="10">
                    📱
                  </text>
                )}
                {node.type === "ring_card" && (
                  <text y="-3" textAnchor="middle" fill="#fef08a" fontSize="10">
                    ⚠️
                  </text>
                )}
                {node.type === "prior_case" && (
                  <text y="-3" textAnchor="middle" fill="#fde047" fontSize="10">
                    📜
                  </text>
                )}

                {/* Node Label */}
                <text
                  y={style.radius + 14}
                  textAnchor="middle"
                  fill="#f1f5f9"
                  fontSize="9.5"
                  fontWeight="600"
                  fontFamily="sans-serif"
                >
                  {node.label}
                </text>

                {/* Secondary Type / Status Subtitle */}
                <text
                  y={style.radius + 24}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="7.5"
                  fontFamily="monospace"
                >
                  {node.type.toUpperCase()}
                  {node.status ? ` · ${node.status}` : ""}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Bottom Status bar */}
      <div className="absolute bottom-2 left-3 z-10 flex items-center gap-2 text-[10px] text-slate-500 font-mono">
        <span>TigerGraph Topology GraphRAG</span>
        <span>•</span>
        <span>{layoutData.nodes.length} Vertices</span>
        <span>•</span>
        <span>{layoutData.links.length} Edges</span>
      </div>

      {/* Selected Node Details Drawer */}
      {selectedNode && (
        <div className="absolute bottom-3 right-3 z-20 w-80 bg-slate-900/95 backdrop-blur border border-slate-700/80 rounded-xl p-3.5 shadow-2xl text-xs space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5">
              <Info className="w-4 h-4 text-cyan-400" />
              <span className="font-bold text-slate-100 font-mono">{selectedNode.label}</span>
            </div>
            <button
              onClick={() => {
                setInternalSelectedId(null);
                if (onNodeSelect) onNodeSelect(null);
              }}
              className="text-slate-400 hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1.5 text-slate-300">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">Vertex ID:</span>
              <span className="font-mono text-cyan-400">{selectedNode.id}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">Vertex Type:</span>
              <span className="font-mono text-slate-200 uppercase">{selectedNode.type}</span>
            </div>
            {selectedNode.status && (
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Status:</span>
                <span className="font-mono text-amber-400 font-bold uppercase">{selectedNode.status}</span>
              </div>
            )}

            {/* Custom attributes */}
            {selectedNode.details && Object.entries(selectedNode.details).map(([key, val]) => (
              <div key={key} className="flex justify-between text-[11px] pt-1 border-t border-slate-800/60">
                <span className="text-slate-500 capitalize">{key.replace(/_/g, " ")}:</span>
                <span className="font-mono text-slate-200 truncate max-w-[170px]" title={String(val)}>
                  {typeof val === "number" ? val.toFixed(2) : String(val)}
                </span>
              </div>
            ))}
          </div>

          <div className="text-[10px] text-slate-500 pt-1 italic">
            Directly connected to {
              layoutData.links.filter(
                (l) => l.source === selectedNode.id || l.target === selectedNode.id
              ).length
            } graph neighbor vertices.
          </div>
        </div>
      )}
    </div>
  );
};
