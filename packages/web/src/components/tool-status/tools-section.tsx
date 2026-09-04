import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { MapView, type MapViewProps } from "../elements/map-view";
import { TableView } from "../elements/table-view";
import type { ToolType } from "../tool-card/tool-config";
import { toolConfig } from "../tool-card/tool-config";
import { Weather, type WeatherAtLocation } from "../weather";
import { type ToolPart, ToolStatus } from "./tool-status";

// Tool part types from message parts
type ToolPartInput = {
  type: string;
  toolCallId: string;
  state:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
  input?: Record<string, unknown>;
  output?: unknown;
};

type ToolsSectionProps = {
  parts: ToolPartInput[];
  toolsSummary: string | null;
};

// Type definitions for tool outputs

type DataQuery = { datasets: string[]; sql: string; limit?: number };

type MapOutput = {
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: Array<{
    lat: number;
    lng: number;
    label?: string;
    description?: string;
    icon?: string;
    color?: string;
  }>;
  polygons?: Array<{
    coordinates: Array<{ lat: number; lng: number }>;
    label?: string;
    fillColor?: string;
    fillOpacity?: number;
    fillPattern?: "solid" | "stripes" | "crosshatch" | "dots";
    strokeColor?: string;
    strokeWidth?: number;
    strokeOpacity?: number;
    strokeStyle?: "solid" | "dashed" | "dotted";
  }>;
  lines?: Array<{
    coordinates: Array<{ lat: number; lng: number }>;
    label?: string;
    strokeColor?: string;
    strokeWidth?: number;
    strokeOpacity?: number;
    strokeStyle?: "solid" | "dashed" | "dotted";
  }>;
  legend?: Array<{ label: string; icon?: string; color?: string }>;
  fitBounds?: boolean;
  title?: string;
  queryInfo?: { totalResults: number; shown: number; truncated: boolean };
  queryError?: string;
  markersCount?: number;
  polygonsCount?: number;
  linesCount?: number;
  // New format (array of queries)
  dataQueries?: DataQuery[];
  // Legacy format (single query) - for backwards compatibility with old saved chats
  dataQuery?: DataQuery;
};

type TableOutput = {
  description?: string;
  title?: string;
  sheetName?: string;
  columns?: Array<{ key: string; name: string }>;
  rows?: Array<Record<string, unknown>>;
  totalRows?: number;
  truncated?: boolean;
  queryError?: string;
  dataQuery?: { datasets: string[]; sql: string; limit?: number };
};

// Generic type for tool input/output with description
type ToolWithDescription = {
  description?: string;
  [key: string]: unknown;
};

// Visual tool types that should end a tool status section
const VISUAL_TOOL_TYPES = new Set([
  "tool-getWeather",
  "tool-showMap",
  "tool-showTable",
]);

// A group of tools that ends with an optional visual output
type ToolGroup = {
  tools: ToolPart[];
  visualOutput: ReactNode | null;
};

/**
 * Groups tool parts and renders them as compact status indicators.
 * Each visual output (map, table, weather) ends its section,
 * so multiple visuals result in multiple sections.
 */
export function ToolsSection({ parts, toolsSummary }: ToolsSectionProps) {
  // Group tools into sections, splitting when a visual output is encountered
  const toolGroups = useMemo(() => {
    const groups: ToolGroup[] = [];
    let currentTools: ToolPart[] = [];

    for (const part of parts) {
      if (!part.type.startsWith("tool-")) continue;

      const type = part.type as ToolType;
      const config = toolConfig[type];
      if (!config) continue;

      // Get user-friendly description from input or output
      const input = part.input as ToolWithDescription | undefined;
      const output = part.output as ToolWithDescription | undefined;
      const description = input?.description ?? output?.description;

      const toolPart: ToolPart = {
        type,
        toolCallId: part.toolCallId,
        state: part.state,
        description,
      };

      currentTools.push(toolPart);

      // If this is a visual tool with output, end the current group
      if (VISUAL_TOOL_TYPES.has(type) && part.state === "output-available") {
        let visualOutput: ReactNode = null;

        if (type === "tool-getWeather") {
          visualOutput = <WeatherVisual key={part.toolCallId} part={part} />;
        } else if (type === "tool-showMap") {
          visualOutput = <MapVisual key={part.toolCallId} part={part} />;
        } else if (type === "tool-showTable") {
          visualOutput = <TableVisual key={part.toolCallId} part={part} />;
        }

        groups.push({
          tools: currentTools,
          visualOutput,
        });
        currentTools = [];
      }
    }

    // Add remaining tools without visual output
    if (currentTools.length > 0) {
      groups.push({
        tools: currentTools,
        visualOutput: null,
      });
    }

    return groups;
  }, [parts]);

  if (toolGroups.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {toolGroups.map((group, index) => {
        // Only pass summary to the last group
        const isLastGroup = index === toolGroups.length - 1;
        return (
          <ToolStatus
            key={group.tools[0]?.toolCallId ?? index}
            summaryText={isLastGroup ? toolsSummary : null}
            tools={group.tools}
            visualOutputs={group.visualOutput}
          />
        );
      })}
    </div>
  );
}

// Weather visual output component
function WeatherVisual({ part }: { part: ToolPartInput }) {
  const output = part.output as WeatherAtLocation | undefined;
  const isReady = part.state === "output-available" && output;

  if (!isReady) return null;

  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-3 dark:border-sky-800 dark:bg-sky-900/20">
      <Weather weatherAtLocation={output} />
    </div>
  );
}

// Map visual output component with data fetching logic
function MapVisual({ part }: { part: ToolPartInput }) {
  const state = part.state;
  const output = part.output as MapOutput | undefined;

  // State for re-fetched data (when loading from stripped saves)
  const [fetchedData, setFetchedData] = useState<{
    markers: NonNullable<MapOutput["markers"]>;
    polygons: NonNullable<MapOutput["polygons"]>;
    lines: NonNullable<MapOutput["lines"]>;
  } | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);

  // Normalize queries: support both new format (dataQueries) and legacy format (dataQuery)
  const normalizedQueries = useMemo(() => {
    if (Array.isArray(output?.dataQueries) && output.dataQueries.length > 0) {
      return output.dataQueries;
    }
    // Legacy format: single dataQuery
    if (output?.dataQuery) {
      return [output.dataQuery];
    }
    return [];
  }, [output?.dataQueries, output?.dataQuery]);

  // Check if we need to fetch data
  const hasFullData = Array.isArray(output?.markers);
  const hasDataQueries = normalizedQueries.length > 0;
  const needsFetch =
    state === "output-available" && !hasFullData && hasDataQueries;

  // Fetch data when we have dataQueries but no markers
  useEffect(() => {
    if (!needsFetch || isFetching || fetchedData || fetchFailed) return;

    const fetchMapData = async () => {
      setIsFetching(true);
      try {
        const results = await Promise.all(
          normalizedQueries.map((query) =>
            fetch("/api/map/query", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(query),
            }).then((res) => (res.ok ? res.json() : null))
          )
        );

        const combinedMarkers: NonNullable<MapOutput["markers"]> = [];
        const combinedPolygons: NonNullable<MapOutput["polygons"]> = [];
        const combinedLines: NonNullable<MapOutput["lines"]> = [];

        for (const result of results) {
          if (result) {
            if (result.markers) combinedMarkers.push(...result.markers);
            if (result.polygons) combinedPolygons.push(...result.polygons);
            if (result.lines) combinedLines.push(...result.lines);
          }
        }

        setFetchedData({
          markers: combinedMarkers,
          polygons: combinedPolygons,
          lines: combinedLines,
        });
      } catch (error) {
        console.error("[MapVisual] Failed to fetch map data:", error);
        setFetchFailed(true);
      } finally {
        setIsFetching(false);
      }
    };

    fetchMapData();
  }, [needsFetch, isFetching, fetchedData, fetchFailed, normalizedQueries]);

  // Stabilize map props
  // biome-ignore lint/correctness/useExhaustiveDependencies: using JSON.stringify for deep comparison
  const stableMapProps = useMemo(() => {
    if (state !== "output-available" || !output) {
      return null;
    }
    if (needsFetch && !fetchedData) {
      return null;
    }

    const markers = fetchedData?.markers ?? output.markers ?? [];
    const polygons = fetchedData?.polygons ?? output.polygons ?? [];
    const lines = fetchedData?.lines ?? output.lines ?? [];

    if (markers.length === 0 && polygons.length === 0 && lines.length === 0) {
      return null;
    }

    const center = output.center ?? { lat: 52.07, lng: 4.3 };

    return {
      center,
      zoom: output.zoom ?? 13,
      markers: markers as MapViewProps["markers"],
      polygons: polygons as MapViewProps["polygons"],
      lines: lines as MapViewProps["lines"],
      legend: (output.legend ?? []) as MapViewProps["legend"],
      fitBounds: output.fitBounds ?? true,
      title: output.title,
    };
  }, [state, needsFetch, fetchedData, output ? JSON.stringify(output) : null]);

  if (!stableMapProps) return null;

  return (
    <MapView
      center={stableMapProps.center}
      fitBounds={stableMapProps.fitBounds}
      legend={stableMapProps.legend}
      lines={stableMapProps.lines}
      markers={stableMapProps.markers}
      polygons={stableMapProps.polygons}
      title={stableMapProps.title}
      zoom={stableMapProps.zoom}
    />
  );
}

// Table visual output component with data fetching logic
function TableVisual({ part }: { part: ToolPartInput }) {
  const state = part.state;
  const output = part.output as TableOutput | undefined;

  // State for re-fetched data (when loading from stripped saves)
  const [fetchedData, setFetchedData] = useState<{
    columns: NonNullable<TableOutput["columns"]>;
    rows: NonNullable<TableOutput["rows"]>;
    totalRows: number;
  } | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);

  // Check if we need to fetch data
  const hasFullData = Array.isArray(output?.rows);
  const hasDataQuery = output?.dataQuery != null;
  const needsFetch =
    state === "output-available" && !hasFullData && hasDataQuery;

  // Fetch data when we have dataQuery but no rows
  useEffect(() => {
    if (!needsFetch || isFetching || fetchedData || fetchFailed) return;

    const fetchTableData = async () => {
      setIsFetching(true);
      try {
        const query = output?.dataQuery;
        if (!query) return;

        const response = await fetch("/api/table/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(query),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch table data");
        }

        const result = await response.json();
        setFetchedData({
          columns: result.columns ?? [],
          rows: result.rows ?? [],
          totalRows: result.totalRows ?? result.rows?.length ?? 0,
        });
      } catch (error) {
        console.error("[TableVisual] Failed to fetch table data:", error);
        setFetchFailed(true);
      } finally {
        setIsFetching(false);
      }
    };

    fetchTableData();
  }, [needsFetch, isFetching, fetchedData, fetchFailed, output?.dataQuery]);

  // Stabilize table props
  const stableTableProps = useMemo(() => {
    if (state !== "output-available" || !output) {
      return null;
    }
    if (needsFetch && !fetchedData) {
      return null;
    }

    const columns = fetchedData?.columns ?? output.columns ?? [];
    const rows = fetchedData?.rows ?? output.rows ?? [];
    const totalRows = fetchedData?.totalRows ?? output.totalRows ?? rows.length;

    if (columns.length === 0 || rows.length === 0) {
      return null;
    }

    return {
      columns,
      rows,
      title: output.title,
      sheetName: output.sheetName,
      totalRows,
      truncated: output.truncated,
    };
  }, [state, needsFetch, fetchedData, output]);

  if (!stableTableProps) return null;

  return (
    <TableView
      columns={stableTableProps.columns}
      rows={stableTableProps.rows}
      sheetName={stableTableProps.sheetName}
      title={stableTableProps.title}
      totalRows={stableTableProps.totalRows}
      truncated={stableTableProps.truncated}
    />
  );
}
