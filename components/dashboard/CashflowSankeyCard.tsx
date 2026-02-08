"use client";

import React from "react";
import { useMemo, useState } from "react";
import { formatCurrency, formatMonth } from "@/lib/cashflow";
import type {
  CashflowSankeyData,
  CashflowSankeyMode,
  CashflowSankeyNode,
  CashflowSankeyLink,
  CashflowSankeyVariants,
} from "@/lib/cashflowSankey";

interface CashflowSankeyCardProps {
  month: string;
  data: CashflowSankeyVariants;
}

const LINK_COLORS: Record<string, string> = {
  income: "rgba(22, 163, 74, 0.4)",
  outflow: "rgba(14, 165, 233, 0.4)",
  balance: "rgba(245, 158, 11, 0.45)",
};

const NODE_WIDTH = 18;
const NODE_GAP = 16;
const MIN_NODE_HEIGHT = 12;
const TOP_PADDING = 16;
const BOTTOM_PADDING = 16;

interface PositionedNode extends CashflowSankeyNode {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

interface PositionedLink extends CashflowSankeyLink {
  sourceNode: PositionedNode;
  targetNode: PositionedNode;
  width: number;
  sy: number;
  ty: number;
}

function truncateLabel(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

function buildLinkPath(link: PositionedLink): string {
  const x0 = link.sourceNode.x1;
  const x1 = link.targetNode.x0;
  const y0 = link.sy;
  const y1 = link.ty;
  const curvature = Math.max(40, Math.abs(x1 - x0) * 0.5);
  const c0 = x0 + curvature;
  const c1 = x1 - curvature;
  return `M ${x0} ${y0} C ${c0} ${y0}, ${c1} ${y1}, ${x1} ${y1}`;
}

export function CashflowSankeyCard({ month, data }: CashflowSankeyCardProps) {
  const [mode, setMode] = useState<CashflowSankeyMode>("source");
  const activeData: CashflowSankeyData = mode === "source" ? data.source : data.category;
  const width = 920;
  const height = Math.max(300, activeData.nodes.length * 34);

  const { nodes, links } = useMemo(() => {
    if (activeData.nodes.length === 0 || activeData.links.length === 0) {
      return { nodes: [], links: [] };
    }

    const leftPadding = 40;
    const rightPadding = 40;
    const maxColumn = Math.max(...activeData.nodes.map((node) => node.column), 0);
    const columns = new Map<number, CashflowSankeyNode[]>();
    for (const node of activeData.nodes) {
      const list = columns.get(node.column) ?? [];
      list.push(node);
      columns.set(node.column, list);
    }

    const positionedNodes: PositionedNode[] = [];

    for (let column = 0; column <= maxColumn; column++) {
      const columnNodes = columns.get(column) ?? [];
      if (columnNodes.length === 0) continue;

      const sortedNodes = [...columnNodes].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
      const sum = columnNodes.reduce((acc, node) => acc + node.value, 0);
      const availableHeight =
        height - TOP_PADDING - BOTTOM_PADDING - (columnNodes.length - 1) * NODE_GAP;
      const scale = sum > 0 ? availableHeight / sum : 0;

      const rawHeights = sortedNodes.map((node) => Math.max(MIN_NODE_HEIGHT, node.value * scale));
      const usedHeight = rawHeights.reduce((acc, value) => acc + value, 0) + (sortedNodes.length - 1) * NODE_GAP;
      let y = Math.max(TOP_PADDING, (height - usedHeight) / 2);
      const xProgress = maxColumn > 0 ? column / maxColumn : 0.5;
      const x0 = leftPadding + (width - leftPadding - rightPadding - NODE_WIDTH) * xProgress;
      const x1 = x0 + NODE_WIDTH;

      for (let index = 0; index < sortedNodes.length; index++) {
        const node = sortedNodes[index];
        const nodeHeight = rawHeights[index];
        positionedNodes.push({
          ...node,
          x0,
          x1,
          y0: y,
          y1: y + nodeHeight,
        });
        y += nodeHeight + NODE_GAP;
      }
    }

    const nodeById = new Map(positionedNodes.map((node) => [node.id, node]));
    const outgoingTotals = new Map<string, number>();
    const incomingTotals = new Map<string, number>();
    for (const link of activeData.links) {
      outgoingTotals.set(link.source, (outgoingTotals.get(link.source) ?? 0) + link.value);
      incomingTotals.set(link.target, (incomingTotals.get(link.target) ?? 0) + link.value);
    }

    const sourceOffsets = new Map<string, number>();
    const targetOffsets = new Map<string, number>();
    const positionedLinks: PositionedLink[] = [];

    for (const link of activeData.links) {
      const sourceNode = nodeById.get(link.source);
      const targetNode = nodeById.get(link.target);
      if (!sourceNode || !targetNode) continue;

      const sourceTotal = outgoingTotals.get(link.source) ?? link.value;
      const targetTotal = incomingTotals.get(link.target) ?? link.value;
      const sourceWidth = ((sourceNode.y1 - sourceNode.y0) * link.value) / Math.max(sourceTotal, 1);
      const targetWidth = ((targetNode.y1 - targetNode.y0) * link.value) / Math.max(targetTotal, 1);
      const linkWidth = Math.max(1.5, Math.min(sourceWidth, targetWidth));
      const sourceOffset = sourceOffsets.get(link.source) ?? 0;
      const targetOffset = targetOffsets.get(link.target) ?? 0;
      const sy = sourceNode.y0 + sourceOffset + linkWidth / 2;
      const ty = targetNode.y0 + targetOffset + linkWidth / 2;

      sourceOffsets.set(link.source, sourceOffset + linkWidth);
      targetOffsets.set(link.target, targetOffset + linkWidth);

      positionedLinks.push({
        ...link,
        sourceNode,
        targetNode,
        width: linkWidth,
        sy,
        ty,
      });
    }

    return { nodes: positionedNodes, links: positionedLinks };
  }, [activeData.links, activeData.nodes, height, width]);

  if (activeData.nodes.length === 0 || activeData.links.length === 0) {
    return (
      <div className="card p-6" data-testid="cashflow-sankey-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-slate-600 dark:text-slate-400">Cashflow Flow Map</h2>
          <span className="text-xs text-slate-500 dark:text-slate-500">{formatMonth(month)}</span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No qualifying cashflow transactions for this month.
        </p>
      </div>
    );
  }

  const totalFlow = Math.max(activeData.totals.inflow, activeData.totals.outflow, 1);
  const maxRenderedColumn = Math.max(...nodes.map((node) => node.column), 0);
  const expectedIncome = activeData.projection?.expectedIncome ?? 0;
  const expectedOutflow = activeData.projection?.expectedOutflow ?? 0;
  const projectedNet = activeData.projection?.projectedNet ?? activeData.totals.net;
  const hasExpectedLayer = expectedIncome > 0 || expectedOutflow > 0;

  return (
    <div className="card p-6" data-testid="cashflow-sankey-card">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-sm font-medium text-slate-600 dark:text-slate-400">Cashflow Flow Map</h2>
          <p className="text-xs text-slate-500 dark:text-slate-500">{formatMonth(month)}</p>
          <div className="mt-2 inline-flex rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              type="button"
              className={`px-2 py-1 text-xs ${
                mode === "source"
                  ? "bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900"
                  : "bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300"
              }`}
              onClick={() => setMode("source")}
            >
              Source View
            </button>
            <button
              type="button"
              className={`px-2 py-1 text-xs border-l border-slate-200 dark:border-slate-700 ${
                mode === "category"
                  ? "bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900"
                  : "bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300"
              }`}
              onClick={() => setMode("category")}
            >
              Category View
            </button>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 dark:text-slate-400">Net</p>
          <p
            className={`text-sm font-semibold ${
              activeData.totals.net >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {formatCurrency(activeData.totals.net)}
          </p>
          {hasExpectedLayer && (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Projected Net</p>
              <p
                className={`text-xs font-semibold ${
                  projectedNet >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {formatCurrency(projectedNet)}
              </p>
            </>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        Flows are an allocation view for the month through a pooled cash model.
      </p>

      {hasExpectedLayer && (
        <div className="mb-3 p-3 rounded border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30">
          <div className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500" />
              Expected Income (remaining): {formatCurrency(expectedIncome)}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500" />
              Expected Outflow (budget): {formatCurrency(expectedOutflow)}
            </span>
          </div>
        </div>
      )}

      <div className="overflow-x-auto -mx-1 px-1" data-testid="cashflow-sankey-scroll">
        <svg width={width} height={height} role="img" aria-label="Cashflow Sankey diagram">
          <g>
            {links.map((link, index) => {
              const percent = ((link.value / totalFlow) * 100).toFixed(1);

              return (
                <path
                  key={`${link.source}-${link.target}-${index}`}
                  d={buildLinkPath(link)}
                  fill="none"
                  stroke={LINK_COLORS[link.kind] ?? "rgba(100, 116, 139, 0.45)"}
                  strokeWidth={Math.max(1, link.width)}
                  strokeOpacity={0.9}
                >
                  <title>
                    {`${link.sourceNode.label} -> ${link.targetNode.label}: ${formatCurrency(link.value)} (${percent}%)`}
                  </title>
                </path>
              );
            })}
          </g>

          <g>
            {nodes.map((node, index) => {
              const widthValue = Math.max(1, node.x1 - node.x0);
              const heightValue = Math.max(1, node.y1 - node.y0);
              const label = node.label;
              const isLeftSide = node.column <= maxRenderedColumn / 2;

              return (
                <g key={`${node.id}-${index}`}>
                  <rect
                    x={node.x0}
                    y={node.y0}
                    width={widthValue}
                    height={heightValue}
                    fill={node.color}
                    rx={2}
                  >
                    <title>{`${label}: ${formatCurrency(node.value ?? 0)}`}</title>
                  </rect>
                  <text
                    x={isLeftSide ? node.x1 + 6 : node.x0 - 6}
                    y={(node.y0 + node.y1) / 2}
                    dy="0.35em"
                    textAnchor={isLeftSide ? "start" : "end"}
                    className="fill-slate-700 dark:fill-slate-300"
                    fontSize={12}
                  >
                    <title>{label}</title>
                    {truncateLabel(label, 24)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-green-600 dark:bg-green-500" />
          Income
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-sky-500 dark:bg-sky-400" />
          Outflow
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-500 dark:bg-amber-400" />
          Balancing
        </span>
        {hasExpectedLayer && (
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500" />
            Expected
          </span>
        )}
      </div>
    </div>
  );
}
