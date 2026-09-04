import {
  AlertTriangle,
  Beer,
  Bike,
  Building,
  Bus,
  Car,
  Carrot,
  Church,
  Coffee,
  Construction,
  Droplet,
  Expand,
  Factory,
  Flag,
  Flower,
  Heart,
  Home,
  Hospital,
  Info,
  Landmark,
  Layers,
  Leaf,
  type LucideIcon,
  MapPin,
  Plane,
  Recycle,
  School,
  Ship,
  ShoppingBag,
  Shrink,
  Sprout,
  Star,
  Store,
  Sun,
  Train,
  Trash,
  TreeDeciduous,
  Trees,
  Utensils,
  Warehouse,
  Wind,
  Zap,
} from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useVirtualizer } from "@tanstack/react-virtual";
import DOMPurify from "dompurify";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

/**
 * Escapes HTML entities to prevent XSS attacks in popup content.
 * Used for user-controlled data that comes from external sources like CKAN.
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Sanitizes a URL to prevent javascript: protocol attacks.
 * Only allows http:, https:, and mailto: protocols.
 */
function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (["http:", "https:", "mailto:"].includes(parsed.protocol)) {
      return url;
    }
    return "";
  } catch {
    return "";
  }
}

/**
 * Builds sanitized popup HTML content from marker properties.
 * All user-controlled data is escaped to prevent XSS attacks.
 */
function buildPopupContent(
  label?: string | null,
  description?: string | null,
  url?: string | null,
  urlLabel?: string | null
): string {
  const parts: string[] = [];

  if (label) {
    parts.push(`<strong>${escapeHtml(label)}</strong>`);
  }
  if (description) {
    parts.push(`<p style="margin: 4px 0;">${escapeHtml(description)}</p>`);
  }
  if (url) {
    const safeUrl = sanitizeUrl(url);
    if (safeUrl) {
      const linkLabel = urlLabel ? escapeHtml(urlLabel) : "Meer info";
      parts.push(
        `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: underline;">${linkLabel}</a>`
      );
    }
  }

  if (parts.length === 0) return "";

  return DOMPurify.sanitize(
    `<div style="color: var(--foreground);">${parts.join("")}</div>`
  );
}

export type MarkerIcon =
  | "mapPin"
  | "tree"
  | "trees"
  | "leaf"
  | "flower"
  | "building"
  | "home"
  | "landmark"
  | "store"
  | "warehouse"
  | "factory"
  | "school"
  | "hospital"
  | "church"
  | "park"
  | "car"
  | "bike"
  | "bus"
  | "train"
  | "plane"
  | "ship"
  | "utensils"
  | "coffee"
  | "beer"
  | "shoppingBag"
  | "heart"
  | "star"
  | "flag"
  | "info"
  | "alertTriangle"
  | "construction"
  | "trash"
  | "recycle"
  | "droplet"
  | "zap"
  | "sun"
  | "wind"
  | "sprout"
  | "carrot";

const ICON_MAP: Record<MarkerIcon, LucideIcon> = {
  mapPin: MapPin,
  tree: TreeDeciduous,
  trees: Trees,
  leaf: Leaf,
  flower: Flower,
  building: Building,
  home: Home,
  landmark: Landmark,
  store: Store,
  warehouse: Warehouse,
  factory: Factory,
  school: School,
  hospital: Hospital,
  church: Church,
  park: Trees,
  car: Car,
  bike: Bike,
  bus: Bus,
  train: Train,
  plane: Plane,
  ship: Ship,
  utensils: Utensils,
  coffee: Coffee,
  beer: Beer,
  shoppingBag: ShoppingBag,
  heart: Heart,
  star: Star,
  flag: Flag,
  info: Info,
  alertTriangle: AlertTriangle,
  construction: Construction,
  trash: Trash,
  recycle: Recycle,
  droplet: Droplet,
  zap: Zap,
  sun: Sun,
  wind: Wind,
  sprout: Sprout,
  carrot: Carrot,
};

export type MapMarker = {
  lat: number;
  lng: number;
  label?: string;
  description?: string;
  url?: string;
  urlLabel?: string;
  icon?: MarkerIcon;
  color?: string; // Preset (red, blue, etc.) or hex (#ff5500) or rgb
};

export type MapPolygon = {
  coordinates: { lat: number; lng: number }[];
  label?: string;
  // Fill properties
  fillColor?: string; // Preset or hex/rgb
  fillOpacity?: number;
  fillPattern?: "solid" | "stripes" | "crosshatch" | "dots";
  // Stroke/outline properties
  strokeColor?: string; // Defaults to fillColor if not set
  strokeWidth?: number;
  strokeOpacity?: number;
  strokeStyle?: "solid" | "dashed" | "dotted";
};

export type MapLine = {
  coordinates: { lat: number; lng: number }[];
  label?: string;
  strokeColor?: string; // Preset or hex/rgb
  strokeWidth?: number;
  strokeOpacity?: number;
  strokeStyle?: "solid" | "dashed" | "dotted";
};

export type LegendItem = {
  color?: string; // Preset or hex/rgb
  icon?: MarkerIcon;
  label: string;
};

type MapStyle = "street" | "satellite" | "dark";

export type MapViewProps = {
  center: { lat: number; lng: number };
  zoom: number;
  markers: MapMarker[];
  polygons?: MapPolygon[];
  lines?: MapLine[];
  legend?: LegendItem[];
  fitBounds?: boolean;
  title?: string;
  className?: string;
};

const MARKER_COLORS: Record<string, string> = {
  red: "#ef4444",
  blue: "#3b82f6",
  green: "#22c55e",
  orange: "#f97316",
  purple: "#a855f7",
};

// Resolve color - returns hex value for presets, or the color directly if it's already a valid CSS color
function resolveColor(color: string | undefined, fallback = "#ef4444"): string {
  if (!color) return fallback;
  // Check if it's a preset color name
  if (color in MARKER_COLORS) {
    return MARKER_COLORS[color];
  }
  // Otherwise return the color directly (hex, rgb, etc.)
  return color;
}

// Generate a fill pattern image for MapLibre
function createPatternImage(
  pattern: "stripes" | "crosshatch" | "dots",
  color: string,
  opacity: number
): ImageData {
  const size = 16; // Pattern tile size
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not get 2d canvas context");
  }

  // Apply opacity to the color
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;

  switch (pattern) {
    case "stripes": {
      // Diagonal stripes
      ctx.beginPath();
      ctx.moveTo(0, size);
      ctx.lineTo(size, 0);
      ctx.moveTo(-size / 2, size / 2);
      ctx.lineTo(size / 2, -size / 2);
      ctx.moveTo(size / 2, size + size / 2);
      ctx.lineTo(size + size / 2, size / 2);
      ctx.stroke();
      break;
    }
    case "crosshatch": {
      // Cross-hatch pattern
      ctx.beginPath();
      // Diagonal one way
      ctx.moveTo(0, size);
      ctx.lineTo(size, 0);
      ctx.moveTo(-size / 2, size / 2);
      ctx.lineTo(size / 2, -size / 2);
      ctx.moveTo(size / 2, size + size / 2);
      ctx.lineTo(size + size / 2, size / 2);
      // Diagonal other way
      ctx.moveTo(0, 0);
      ctx.lineTo(size, size);
      ctx.moveTo(-size / 2, size / 2);
      ctx.lineTo(size / 2, size + size / 2);
      ctx.moveTo(size / 2, -size / 2);
      ctx.lineTo(size + size / 2, size / 2);
      ctx.stroke();
      break;
    }
    case "dots": {
      // Dot pattern
      const dotRadius = 2;
      const spacing = size / 2;
      for (let x = spacing / 2; x < size; x += spacing) {
        for (let y = spacing / 2; y < size; y += spacing) {
          ctx.beginPath();
          ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
  }

  return ctx.getImageData(0, 0, size, size);
}

const MAP_STYLES: Record<MapStyle, maplibregl.StyleSpecification> = {
  street: {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    },
    layers: [
      {
        id: "osm",
        type: "raster",
        source: "osm",
      },
    ],
  },
  satellite: {
    version: 8,
    sources: {
      esri: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        attribution:
          "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
      },
    },
    layers: [
      {
        id: "esri",
        type: "raster",
        source: "esri",
      },
    ],
  },
  dark: {
    version: 8,
    sources: {
      carto: {
        type: "raster",
        tiles: [
          "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
          "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
          "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        ],
        tileSize: 256,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      },
    },
    layers: [
      {
        id: "carto",
        type: "raster",
        source: "carto",
      },
    ],
  },
};

// Source and layer IDs for WebGL rendering
const POINTS_SOURCE = "points-source";
const CLUSTERS_LAYER = "clusters";
const CLUSTER_COUNT_LAYER = "cluster-count";
const UNCLUSTERED_LAYER = "unclustered-point";

export const MapView = memo(function MapViewInner({
  center,
  zoom,
  markers: markersProp,
  polygons: polygonsProp = [],
  lines: linesProp = [],
  legend = [],
  fitBounds = true,
  title,
  className,
}: MapViewProps) {
  // Defensive fallbacks for undefined data (can happen with old stripped saves)
  const markers = markersProp ?? [];
  const polygons = polygonsProp ?? [];
  const lines = linesProp ?? [];

  // DEBUG: Log what data MapView receives
  console.log("[MapView] Received props:", {
    markersCount: markers.length,
    polygonsCount: polygons.length,
    linesCount: lines.length,
    title,
    firstMarker: markers[0] ?? null,
  });
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const legendScrollRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [userMapStyle, setUserMapStyle] = useState<MapStyle | null>(null);
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Detect system/app theme and auto-switch map style
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";

  // Use user-selected style if set, otherwise auto-switch based on theme
  const mapStyle: MapStyle = userMapStyle ?? (isDarkMode ? "dark" : "street");

  const [selectedMarkerIndex, setSelectedMarkerIndex] = useState<number | null>(
    null
  );

  // Clustering disabled - WebGL can handle large datasets efficiently
  const useClustering = false;

  // Virtualizer for legend list - only renders visible items
  const virtualizer = useVirtualizer({
    count: markers.length,
    getScrollElement: () => legendScrollRef.current,
    estimateSize: () => 32, // Approximate height of each item
    overscan: 10, // Render 10 extra items above/below viewport
  });

  // Deferred GeoJSON processing to avoid blocking UI with large datasets
  const [geojsonData, setGeojsonData] = useState<
    GeoJSON.FeatureCollection<GeoJSON.Point>
  >({
    type: "FeatureCollection",
    features: [],
  });
  const [isProcessingData, setIsProcessingData] = useState(false);

  useEffect(() => {
    console.log(
      "[MapView] useEffect for geojsonData, markers.length:",
      markers.length
    );
    if (markers.length === 0) {
      setGeojsonData({ type: "FeatureCollection", features: [] });
      return;
    }

    setIsProcessingData(true);

    // Use requestIdleCallback for better performance, fallback to setTimeout
    const processData = () => {
      console.log(
        "[MapView] processData running for",
        markers.length,
        "markers"
      );
      const features: GeoJSON.Feature<GeoJSON.Point>[] = markers.map(
        (marker, index) => ({
          type: "Feature",
          properties: {
            index,
            label: marker.label ?? "",
            description: marker.description ?? "",
            url: marker.url ?? "",
            urlLabel: marker.urlLabel ?? "",
            icon: marker.icon ?? "mapPin",
            color: resolveColor(marker.color),
          },
          geometry: {
            type: "Point",
            coordinates: [marker.lng, marker.lat],
          },
        })
      );

      setGeojsonData({ type: "FeatureCollection", features });
      setIsProcessingData(false);
    };

    // Defer processing to next frame so UI can render first
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(processData, { timeout: 100 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(processData, 0);
    return () => clearTimeout(id);
  }, [markers]);

  // Calculate bounds for fit - optimized for large datasets
  const bounds = useMemo(() => {
    if (markers.length === 0 && polygons.length === 0 && lines.length === 0)
      return null;

    let minLat = Number.POSITIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;
    let minLng = Number.POSITIVE_INFINITY;
    let maxLng = Number.NEGATIVE_INFINITY;

    // Process markers
    for (const m of markers) {
      if (m.lat < minLat) minLat = m.lat;
      if (m.lat > maxLat) maxLat = m.lat;
      if (m.lng < minLng) minLng = m.lng;
      if (m.lng > maxLng) maxLng = m.lng;
    }

    // Process polygons
    for (const p of polygons) {
      for (const c of p.coordinates) {
        if (c.lat < minLat) minLat = c.lat;
        if (c.lat > maxLat) maxLat = c.lat;
        if (c.lng < minLng) minLng = c.lng;
        if (c.lng > maxLng) maxLng = c.lng;
      }
    }

    // Process lines
    for (const l of lines) {
      for (const c of l.coordinates) {
        if (c.lat < minLat) minLat = c.lat;
        if (c.lat > maxLat) maxLat = c.lat;
        if (c.lng < minLng) minLng = c.lng;
        if (c.lng > maxLng) maxLng = c.lng;
      }
    }

    if (!Number.isFinite(minLat)) return null;

    return new maplibregl.LngLatBounds([minLng, minLat], [maxLng, maxLat]);
  }, [markers, polygons, lines]);

  // Track if map has fully loaded (including style)
  const mapLoadedRef = useRef(false);
  // Track WebGL context lost state
  const [webglContextLost, setWebglContextLost] = useState(false);

  // Initialize map (only once) - we intentionally use an empty dependency array
  // because we only want to create the map instance once on mount.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally only run once on mount
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLES[mapStyle],
      center: [center.lng, center.lat],
      zoom,
      // Reduce GPU memory usage to prevent WebGL context loss
      maxTileCacheSize: 50,
      fadeDuration: 0,
    });

    map.current = mapInstance;
    mapInstance.addControl(new maplibregl.NavigationControl(), "top-right");

    // Handle WebGL context lost - this can happen with multiple maps
    const canvas = mapInstance.getCanvas();
    const handleContextLost = (e: Event) => {
      console.warn("[MapView] WebGL context lost, preventing default");
      e.preventDefault();
      setWebglContextLost(true);
    };
    const handleContextRestored = () => {
      console.log("[MapView] WebGL context restored, triggering re-render");
      setWebglContextLost(false);
      // Force re-add sources and layers after context restore
      mapInstance.triggerRepaint();
    };
    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);

    // Mark as loaded when the map is fully ready
    mapInstance.once("load", () => {
      mapLoadedRef.current = true;
      setIsMapLoaded(true);
    });

    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      mapLoadedRef.current = false;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Fit bounds when they change (separate from initialization)
  const hasFittedBounds = useRef(false);
  useEffect(() => {
    if (!map.current || !fitBounds || !bounds || hasFittedBounds.current)
      return;

    const mapInstance = map.current;

    // Only fit bounds once when map is ready
    const doFitBounds = () => {
      if (!mapInstance.isStyleLoaded() || hasFittedBounds.current) return;
      mapInstance.fitBounds(bounds, {
        padding: 50,
        maxZoom: 15,
      });
      hasFittedBounds.current = true;
    };

    // Use load event for initial setup, style.load for after initial load
    if (mapLoadedRef.current) {
      if (mapInstance.isStyleLoaded()) {
        doFitBounds();
      } else {
        mapInstance.once("style.load", doFitBounds);
      }
    } else {
      mapInstance.once("load", doFitBounds);
    }

    return () => {
      mapInstance.off("load", doFitBounds);
      mapInstance.off("style.load", doFitBounds);
    };
  }, [fitBounds, bounds]);

  // Update map style (skip on initial mount - handled by initialization effect)
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (!map.current) return;

    // Skip on initial mount - the init effect handles the first style load
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const mapInstance = map.current;

    // Use transformStyle to preserve our custom sources and layers
    // This is the recommended workaround for MapLibre v3.0+ where style.load
    // doesn't fire reliably on subsequent style changes
    // See: https://github.com/maplibre/maplibre-gl-js/issues/2587
    mapInstance.setStyle(MAP_STYLES[mapStyle], {
      transformStyle: (previousStyle, nextStyle) => {
        if (!previousStyle) return nextStyle;

        // Preserve our custom sources
        const customSources: Record<string, maplibregl.SourceSpecification> =
          {};
        if (previousStyle.sources[POINTS_SOURCE]) {
          customSources[POINTS_SOURCE] = previousStyle.sources[POINTS_SOURCE];
        }
        // Preserve polygon and line sources
        for (const key of Object.keys(previousStyle.sources)) {
          if (key.startsWith("polygon-") || key.startsWith("line-source-")) {
            customSources[key] = previousStyle.sources[key];
          }
        }

        // Preserve our custom layers
        const customLayers = previousStyle.layers.filter(
          (layer) =>
            layer.id === UNCLUSTERED_LAYER ||
            layer.id === CLUSTERS_LAYER ||
            layer.id === CLUSTER_COUNT_LAYER ||
            layer.id.startsWith("polygon-") ||
            layer.id.startsWith("line-")
        );

        return {
          ...nextStyle,
          sources: {
            ...nextStyle.sources,
            ...customSources,
          },
          layers: [...nextStyle.layers, ...customLayers],
        };
      },
    });
  }, [mapStyle]);

  // Combined effect for adding polygons, lines, AND points to ensure correct layer order
  // Polygons are added first (bottom), then lines, then points on top
  // Re-runs when webglContextLost changes to re-add layers after context restore
  useEffect(() => {
    // Skip if context is currently lost
    if (webglContextLost) {
      console.log("[MapView] Skipping layer setup - WebGL context lost");
      return;
    }

    if (!map.current) return;

    // Skip if there's nothing to render
    if (polygons.length === 0 && lines.length === 0 && markers.length === 0)
      return;

    // Wait for geojsonData to be ready before setting up point layers
    if (markers.length > 0 && geojsonData.features.length === 0) {
      console.log("[MapView] Waiting for geojsonData to be ready...");
      return;
    }

    const mapInstance = map.current;

    const setupAllLayers = () => {
      // Double-check style is loaded
      if (!mapInstance.isStyleLoaded()) return;

      console.log(
        "[MapView] setupAllLayers called, polygons:",
        polygons.length,
        "lines:",
        lines.length,
        "markers:",
        markers.length
      );

      // === STEP 1: Add/update polygon layers (bottom) ===
      if (polygons.length > 0) {
        // Remove existing polygon layers, sources, and pattern images
        for (let i = 0; i < 100; i++) {
          if (mapInstance.getLayer(`polygon-fill-${i}`)) {
            mapInstance.removeLayer(`polygon-fill-${i}`);
          }
          if (mapInstance.getLayer(`polygon-outline-${i}`)) {
            mapInstance.removeLayer(`polygon-outline-${i}`);
          }
          if (mapInstance.getSource(`polygon-${i}`)) {
            mapInstance.removeSource(`polygon-${i}`);
          }
          // Remove pattern images
          if (mapInstance.hasImage(`pattern-${i}`)) {
            mapInstance.removeImage(`pattern-${i}`);
          }
        }

        // Add new polygons
        for (const [i, polygon] of polygons.entries()) {
          const coordinates = polygon.coordinates.map((c) => [c.lng, c.lat]);
          // Close the polygon
          if (
            coordinates.length > 0 &&
            (coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
              coordinates[0][1] !== coordinates[coordinates.length - 1][1])
          ) {
            coordinates.push(coordinates[0]);
          }

          const fillColor = resolveColor(polygon.fillColor, "#3b82f6");
          const strokeColor = resolveColor(polygon.strokeColor, fillColor);
          const fillOpacity = polygon.fillOpacity ?? 0.2;
          const strokeWidth = polygon.strokeWidth ?? 2;
          const strokeOpacity = polygon.strokeOpacity ?? 1;
          const fillPattern = polygon.fillPattern ?? "solid";
          const strokeStyle = polygon.strokeStyle ?? "solid";

          mapInstance.addSource(`polygon-${i}`, {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: {
                type: "Polygon",
                coordinates: [coordinates],
              },
            },
          });

          // Add fill layer - either solid or with pattern
          if (fillPattern !== "solid" && fillOpacity > 0) {
            // Create and add pattern image
            const patternImage = createPatternImage(
              fillPattern,
              fillColor,
              fillOpacity
            );
            mapInstance.addImage(`pattern-${i}`, patternImage, { sdf: false });

            mapInstance.addLayer({
              id: `polygon-fill-${i}`,
              type: "fill",
              source: `polygon-${i}`,
              paint: {
                "fill-pattern": `pattern-${i}`,
              },
            });
          } else {
            // Solid fill
            mapInstance.addLayer({
              id: `polygon-fill-${i}`,
              type: "fill",
              source: `polygon-${i}`,
              paint: {
                "fill-color": fillColor,
                "fill-opacity": fillOpacity,
              },
            });
          }

          // Add outline layer (if strokeWidth > 0)
          if (strokeWidth > 0) {
            // Convert strokeStyle to dasharray
            let dashArray: number[] | undefined;
            if (strokeStyle === "dashed") {
              dashArray = [2, 2];
            } else if (strokeStyle === "dotted") {
              dashArray = [0.5, 1.5];
            }

            mapInstance.addLayer({
              id: `polygon-outline-${i}`,
              type: "line",
              source: `polygon-${i}`,
              paint: {
                "line-color": strokeColor,
                "line-width": strokeWidth,
                "line-opacity": strokeOpacity,
                ...(dashArray && { "line-dasharray": dashArray }),
              },
            });
          }
        }

        console.log("[MapView] Polygon layers added");
      }

      // === STEP 2: Add/update line layers (middle) ===
      if (lines.length > 0) {
        // Remove existing line layers and sources
        for (let i = 0; i < 100; i++) {
          if (mapInstance.getLayer(`line-${i}`)) {
            mapInstance.removeLayer(`line-${i}`);
          }
          if (mapInstance.getSource(`line-source-${i}`)) {
            mapInstance.removeSource(`line-source-${i}`);
          }
        }

        // Add new lines
        for (const [i, line] of lines.entries()) {
          const coordinates = line.coordinates.map((c) => [c.lng, c.lat]);
          const color = resolveColor(line.strokeColor, "#3b82f6");

          // Convert strokeStyle to MapLibre dasharray
          let dashArray: number[] | undefined;
          if (line.strokeStyle === "dashed") {
            dashArray = [2, 2]; // dash length, gap length (relative to stroke width)
          } else if (line.strokeStyle === "dotted") {
            dashArray = [0.5, 1.5]; // small dash, gap
          }

          mapInstance.addSource(`line-source-${i}`, {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates,
              },
            },
          });

          mapInstance.addLayer({
            id: `line-${i}`,
            type: "line",
            source: `line-source-${i}`,
            paint: {
              "line-color": color,
              "line-width": line.strokeWidth ?? 3,
              "line-opacity": line.strokeOpacity ?? 1,
              ...(dashArray && { "line-dasharray": dashArray }),
            },
            layout: {
              "line-cap": "round",
              "line-join": "round",
            },
          });
        }

        console.log("[MapView] Line layers added");
      }

      // === STEP 3: Add/update point layers (top) ===
      if (markers.length > 0) {
        // Check if source already exists
        const existingSource = mapInstance.getSource(POINTS_SOURCE) as
          | maplibregl.GeoJSONSource
          | undefined;

        if (existingSource) {
          // Source exists, just update the data
          console.log(
            "[MapView] Updating existing point source with",
            geojsonData.features.length,
            "features"
          );
          existingSource.setData(geojsonData);
        } else {
          console.log("[MapView] Creating new point source and layers");

          // Source doesn't exist, create it with layers
          mapInstance.addSource(POINTS_SOURCE, {
            type: "geojson",
            data: geojsonData,
            cluster: useClustering,
            clusterMaxZoom: 14,
            clusterRadius: 50,
          });

          // Cluster circles layer
          if (useClustering) {
            mapInstance.addLayer({
              id: CLUSTERS_LAYER,
              type: "circle",
              source: POINTS_SOURCE,
              filter: ["has", "point_count"],
              paint: {
                "circle-radius": [
                  "step",
                  ["get", "point_count"],
                  18,
                  100,
                  22,
                  750,
                  28,
                  2000,
                  34,
                ],
                "circle-color": "#3b82f6",
                "circle-stroke-width": 3,
                "circle-stroke-color": "#ffffff",
              },
            });

            // Cluster count labels
            mapInstance.addLayer({
              id: CLUSTER_COUNT_LAYER,
              type: "symbol",
              source: POINTS_SOURCE,
              filter: ["has", "point_count"],
              layout: {
                "text-field": "{point_count_abbreviated}",
                "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
                "text-size": 12,
              },
              paint: {
                "text-color": "#ffffff",
              },
            });
          }

          // Unclustered point layer
          mapInstance.addLayer({
            id: UNCLUSTERED_LAYER,
            type: "circle",
            source: POINTS_SOURCE,
            filter: useClustering ? ["!", ["has", "point_count"]] : ["all"],
            paint: {
              "circle-radius": 8,
              "circle-color": ["coalesce", ["get", "color"], "#ef4444"],
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
            },
          });

          console.log("[MapView] Point layers created successfully");
        }
      }
    };

    // Use different event based on whether initial load has completed
    if (mapLoadedRef.current) {
      if (mapInstance.isStyleLoaded()) {
        setupAllLayers();
      } else {
        mapInstance.once("style.load", setupAllLayers);
      }
    } else {
      mapInstance.once("load", setupAllLayers);
    }

    return () => {
      mapInstance.off("load", setupAllLayers);
      mapInstance.off("style.load", setupAllLayers);
    };
  }, [polygons, lines, geojsonData, markers.length, webglContextLost]);

  // Handle click and hover events on clusters and points
  // Uses global map events with feature querying to avoid race conditions with layer setup
  // biome-ignore lint/correctness/useExhaustiveDependencies: geojsonData triggers re-registration when data changes
  useEffect(() => {
    if (!map.current || markers.length === 0) return;

    const mapInstance = map.current;

    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      if (!mapInstance.isStyleLoaded()) return;

      // Check for cluster clicks first (if clustering is enabled)
      if (useClustering && mapInstance.getLayer(CLUSTERS_LAYER)) {
        const clusterFeatures = mapInstance.queryRenderedFeatures(e.point, {
          layers: [CLUSTERS_LAYER],
        });

        if (clusterFeatures.length > 0) {
          const clusterId = clusterFeatures[0].properties?.cluster_id;
          const source = mapInstance.getSource(POINTS_SOURCE) as
            | maplibregl.GeoJSONSource
            | undefined;
          if (source) {
            source.getClusterExpansionZoom(clusterId).then((zoomLevel) => {
              const geometry = clusterFeatures[0].geometry;
              if (geometry.type === "Point") {
                mapInstance.easeTo({
                  center: geometry.coordinates as [number, number],
                  zoom: zoomLevel ?? 14,
                });
              }
            });
          }
          return;
        }
      }

      // Check for point clicks
      if (!mapInstance.getLayer(UNCLUSTERED_LAYER)) return;

      const pointFeatures = mapInstance.queryRenderedFeatures(e.point, {
        layers: [UNCLUSTERED_LAYER],
      });

      if (pointFeatures.length === 0) return;

      const feature = pointFeatures[0];
      const geometry = feature.geometry;
      if (geometry.type !== "Point") return;

      const coordinates = geometry.coordinates.slice() as [number, number];
      const props = feature.properties;

      // Build sanitized popup content (XSS protection)
      const popupHtml = buildPopupContent(
        props?.label,
        props?.description,
        props?.url,
        props?.urlLabel
      );

      if (!popupHtml) return;

      // Remove existing popup
      if (popupRef.current) {
        popupRef.current.remove();
      }

      // Create new popup
      popupRef.current = new maplibregl.Popup({ offset: 15 })
        .setLngLat(coordinates)
        .setHTML(popupHtml)
        .addTo(mapInstance);

      // Update selected marker
      if (props?.index !== undefined) {
        setSelectedMarkerIndex(Number(props.index));
      }
    };

    const handleMapMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (!mapInstance.isStyleLoaded()) return;

      // Check if hovering over any interactive layer
      const layers: string[] = [];
      if (useClustering && mapInstance.getLayer(CLUSTERS_LAYER)) {
        layers.push(CLUSTERS_LAYER);
      }
      if (mapInstance.getLayer(UNCLUSTERED_LAYER)) {
        layers.push(UNCLUSTERED_LAYER);
      }

      if (layers.length === 0) {
        mapInstance.getCanvas().style.cursor = "";
        return;
      }

      const features = mapInstance.queryRenderedFeatures(e.point, { layers });
      mapInstance.getCanvas().style.cursor =
        features.length > 0 ? "pointer" : "";
    };

    // Register global map events
    mapInstance.on("click", handleMapClick);
    mapInstance.on("mousemove", handleMapMouseMove);

    return () => {
      mapInstance.off("click", handleMapClick);
      mapInstance.off("mousemove", handleMapMouseMove);
      mapInstance.getCanvas().style.cursor = "";
    };
  }, [markers.length, geojsonData]);

  // Expanded toggle
  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!isExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsExpanded(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  // Resize map when expanded mode changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: isExpanded triggers resize when mode changes
  useEffect(() => {
    if (map.current) {
      setTimeout(() => {
        map.current?.resize();
      }, 100);
    }
  }, [isExpanded]);

  const handleLegendClick = useCallback(
    (index: number) => {
      const marker = markers[index];
      if (!map.current || !marker) return;

      // Set selected marker
      setSelectedMarkerIndex(index);

      // Close any open popups first
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }

      // Fly to the marker (zoom past cluster maxZoom if clustering is enabled)
      const targetZoom = useClustering ? 15 : 16;
      map.current.flyTo({
        center: [marker.lng, marker.lat],
        zoom: targetZoom,
        duration: 500,
      });

      // Open popup after fly animation
      map.current.once("moveend", () => {
        if (!map.current) return;

        // Build sanitized popup content (XSS protection)
        const popupHtml = buildPopupContent(
          marker.label,
          marker.description,
          marker.url,
          marker.urlLabel
        );

        if (popupHtml) {
          popupRef.current = new maplibregl.Popup({ offset: 15 })
            .setLngLat([marker.lng, marker.lat])
            .setHTML(popupHtml)
            .addTo(map.current);
        }
      });
    },
    [markers]
  );

  const mapContent = (
    <div
      className={cn(
        "flex flex-col gap-2",
        isExpanded && "h-full",
        !isExpanded && className
      )}
    >
      {title && (
        <div className="shrink-0 font-medium text-foreground text-sm">
          {title}
        </div>
      )}
      <div className={cn("flex gap-3", isExpanded && "min-h-0 flex-1")}>
        <div className="relative min-h-0 min-w-0 flex-1">
          <div
            ref={mapContainer}
            className={cn(
              "overflow-hidden rounded-lg border",
              isExpanded ? "h-full" : "aspect-square min-h-[300px]"
            )}
          />

          {/* Loading skeleton while map initializes */}
          {!isMapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg border bg-muted/50">
              <div className="flex flex-col items-center gap-3">
                <div className="size-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
                <span className="text-sm text-muted-foreground">
                  Kaart laden...
                </span>
              </div>
            </div>
          )}

          {/* Loading indicator for large datasets */}
          {isMapLoaded && isProcessingData && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg">
              <div className="flex items-center gap-2 rounded-lg bg-background px-4 py-2 shadow-md border">
                <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm text-muted-foreground">
                  {markers.length.toLocaleString()} punten laden...
                </span>
              </div>
            </div>
          )}

          {/* WebGL context lost indicator */}
          {webglContextLost && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
              <div className="flex flex-col items-center gap-2 rounded-lg bg-background px-4 py-3 shadow-md border">
                <div className="size-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                <span className="text-sm text-muted-foreground">
                  Kaart herstellen...
                </span>
              </div>
            </div>
          )}

          {/* Map controls overlay */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {/* Expand button */}
            <button
              type="button"
              onClick={toggleExpanded}
              className="flex size-8 items-center justify-center rounded bg-background text-foreground shadow hover:bg-muted"
              title={isExpanded ? "Verkleinen" : "Vergroten"}
            >
              {isExpanded ? (
                <Shrink className="size-4" />
              ) : (
                <Expand className="size-4" />
              )}
            </button>

            {/* Layer switcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowStyleMenu(!showStyleMenu)}
                className="flex size-8 items-center justify-center rounded bg-background text-foreground shadow hover:bg-muted"
                title="Kaartlagen"
              >
                <Layers className="size-4" />
              </button>

              {showStyleMenu && (
                <div className="absolute top-0 left-10 z-10 min-w-[120px] rounded border bg-popover p-1 text-popover-foreground shadow-md">
                  <button
                    type="button"
                    onClick={() => {
                      setUserMapStyle("street");
                      setShowStyleMenu(false);
                    }}
                    className={cn(
                      "block w-full rounded px-3 py-1.5 text-left text-sm hover:bg-muted",
                      mapStyle === "street" && "bg-primary/10 text-primary"
                    )}
                  >
                    Straat
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUserMapStyle("satellite");
                      setShowStyleMenu(false);
                    }}
                    className={cn(
                      "block w-full rounded px-3 py-1.5 text-left text-sm hover:bg-muted",
                      mapStyle === "satellite" && "bg-primary/10 text-primary"
                    )}
                  >
                    Satelliet
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUserMapStyle("dark");
                      setShowStyleMenu(false);
                    }}
                    className={cn(
                      "block w-full rounded px-3 py-1.5 text-left text-sm hover:bg-muted",
                      mapStyle === "dark" && "bg-primary/10 text-primary"
                    )}
                  >
                    Donker
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Virtualized Legend - renders only visible items for performance */}
        {markers.length > 0 && (
          <div
            className={cn(
              "flex w-48 shrink-0 flex-col gap-1 overflow-hidden rounded-lg border bg-muted/30 p-2",
              isExpanded ? "h-full" : "aspect-square min-h-[300px]"
            )}
          >
            <div className="flex shrink-0 items-center justify-between">
              <span className="font-medium text-muted-foreground text-xs">
                Overzicht
              </span>
              {markers.length > 100 && (
                <span className="text-xs text-muted-foreground">
                  {markers.length.toLocaleString()} punten
                </span>
              )}
            </div>
            <div
              ref={legendScrollRef}
              className="min-h-0 flex-1 overflow-y-auto"
            >
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualItem) => {
                  const marker = markers[virtualItem.index];
                  const IconComponent = ICON_MAP[marker.icon ?? "mapPin"];
                  const isSelected = selectedMarkerIndex === virtualItem.index;
                  return (
                    <button
                      key={virtualItem.key}
                      className={cn(
                        "absolute left-0 top-0 flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs transition-colors hover:bg-muted",
                        isSelected && "bg-muted/80 font-medium"
                      )}
                      style={{
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                      onClick={() => handleLegendClick(virtualItem.index)}
                      type="button"
                    >
                      <span
                        className="flex size-5 shrink-0 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: resolveColor(marker.color),
                        }}
                      >
                        <IconComponent
                          className="size-3 text-white"
                          strokeWidth={2.5}
                        />
                      </span>
                      <span className="min-w-0 truncate text-foreground">
                        {marker.label || `Punt ${virtualItem.index + 1}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Legend */}
            {legend.length > 0 && (
              <div className="shrink-0 border-t pt-1.5">
                <div className="mb-1 font-medium text-muted-foreground text-xs">
                  Legenda
                </div>
                <div className="flex flex-col gap-0.5">
                  {legend.map((item, idx) => {
                    const IconComponent = item.icon
                      ? ICON_MAP[item.icon]
                      : null;
                    return (
                      <div
                        key={`${item.label}-${idx}`}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground"
                      >
                        {item.color && !item.icon && (
                          <span
                            className="size-3 shrink-0 rounded-full"
                            style={{
                              backgroundColor: resolveColor(item.color),
                            }}
                          />
                        )}
                        {item.icon && (
                          <span
                            className="flex size-4 shrink-0 items-center justify-center rounded-full"
                            style={{
                              backgroundColor: resolveColor(
                                item.color,
                                "#6b7280"
                              ),
                            }}
                          >
                            {IconComponent && (
                              <IconComponent
                                className="size-2.5 text-white"
                                strokeWidth={2.5}
                              />
                            )}
                          </span>
                        )}
                        <span>{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // When expanded, render as overlay covering the chat area
  if (isExpanded) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background p-6">
        {mapContent}
      </div>
    );
  }

  return mapContent;
});
