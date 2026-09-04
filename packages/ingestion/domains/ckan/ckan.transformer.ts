import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import proj4 from "proj4";
import {
	haalGdhDatasetSchemaOp,
	converteerNaarJsonSchema,
	GDH_GEO_LOOKUP_DATASETS,
} from "./gdh-dataportaal-schemas.js";

// EPSG:28992 - Rijksdriehoekscoördinaten (RD New)
const RD_NEW =
	"+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.2369,50.0087,465.658,-0.406857,0.350733,-1.87035,4.0812 +units=m +no_defs";
// EPSG:4326 - WGS84 (GPS coordinates)
const WGS84 = "+proj=longlat +datum=WGS84 +no_defs";

proj4.defs("EPSG:28992", RD_NEW);
proj4.defs("EPSG:4326", WGS84);


export type GeoJSONFeature = {
	type: string;
	geometry: {
		type: string;
		coordinates: unknown;
	} | null;
	properties: Record<string, unknown>;
};

export type GeoJSONCollection = {
	type: string;
	name?: string;
	features: GeoJSONFeature[];
};

export type GeoLookup = {
	wijken: GeoJSONFeature[];
	buurten: GeoJSONFeature[];
	stadsdelen: GeoJSONFeature[];
};

export type TransformResult = {
	records: Record<string, unknown>[];
	schema: Record<string, unknown>;
};

export function rdToWgs84(rdX: number, rdY: number): { lat: number; lng: number } {
	const [lng, lat] = proj4("EPSG:28992", "EPSG:4326", [rdX, rdY]);
	return { lat, lng };
}

function cleanValue(value: unknown): unknown {
	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed === "" ? null : trimmed;
	}
	return value;
}

function cleanProperties(props: Record<string, unknown>): Record<string, unknown> {
	const cleaned: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(props)) {
		cleaned[key] = cleanValue(value);
	}
	return cleaned;
}


function extractCoordinatesFromGeometry(
	geometry: GeoJSONFeature["geometry"],
): { RD_X: number; RD_Y: number; lat: number; lng: number } | null {
	if (!geometry) return null;
	if (geometry.type === "Point" && Array.isArray(geometry.coordinates)) {
		const [x, y] = geometry.coordinates as number[];
		if (typeof x === "number" && typeof y === "number") {
			const { lat, lng } = rdToWgs84(x, y);
			return { RD_X: x, RD_Y: y, lat, lng };
		}
	}
	return null;
}

function convertRing(ring: number[][]): Array<{ lat: number; lng: number }> {
	return ring.map(([x, y]) => rdToWgs84(x, y));
}

function extractPolygonFromGeometry(
	geometry: GeoJSONFeature["geometry"],
): Array<Array<{ lat: number; lng: number }>> | null {
	if (!geometry) return null;

	if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) {
		const coords = geometry.coordinates as number[][][];
		return coords.map((ring) => convertRing(ring));
	}

	if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
		const coords = geometry.coordinates as number[][][][];
		const allRings: Array<Array<{ lat: number; lng: number }>> = [];
		for (const polygon of coords) {
			for (const ring of polygon) {
				allRings.push(convertRing(ring));
			}
		}
		return allRings;
	}

	return null;
}

function extractLineFromGeometry(
	geometry: GeoJSONFeature["geometry"],
): Array<Array<{ lat: number; lng: number }>> | null {
	if (!geometry) return null;

	if (geometry.type === "LineString" && Array.isArray(geometry.coordinates)) {
		const coords = geometry.coordinates as number[][];
		return [convertRing(coords)];
	}

	if (geometry.type === "MultiLineString" && Array.isArray(geometry.coordinates)) {
		const coords = geometry.coordinates as number[][][];
		return coords.map((line) => convertRing(line));
	}

	return null;
}

function extractMultiPointFromGeometry(
	geometry: GeoJSONFeature["geometry"],
): Array<{ lat: number; lng: number; RD_X: number; RD_Y: number }> | null {
	if (!geometry) return null;

	if (geometry.type === "MultiPoint" && Array.isArray(geometry.coordinates)) {
		const coords = geometry.coordinates as number[][];
		return coords.map(([x, y]) => {
			const { lat, lng } = rdToWgs84(x, y);
			return { lat, lng, RD_X: x, RD_Y: y };
		});
	}

	return null;
}

type GeometryCollectionResult = {
	points: Array<{ lat: number; lng: number; RD_X: number; RD_Y: number }>;
	lines: Array<Array<{ lat: number; lng: number }>>;
	polygons: Array<Array<{ lat: number; lng: number }>>;
};

function extractGeometryCollection(
	geometry: GeoJSONFeature["geometry"],
): GeometryCollectionResult | null {
	if (!geometry || geometry.type !== "GeometryCollection") return null;

	const geomCollection = geometry as {
		type: string;
		geometries: Array<{ type: string; coordinates: unknown }>;
	};

	if (!Array.isArray(geomCollection.geometries)) return null;

	const result: GeometryCollectionResult = { points: [], lines: [], polygons: [] };

	for (const geom of geomCollection.geometries) {
		const subGeometry = geom as GeoJSONFeature["geometry"];

		const point = extractCoordinatesFromGeometry(subGeometry);
		if (point) result.points.push(point);

		const multipoint = extractMultiPointFromGeometry(subGeometry);
		if (multipoint) result.points.push(...multipoint);

		const line = extractLineFromGeometry(subGeometry);
		if (line) result.lines.push(...line);

		const polygon = extractPolygonFromGeometry(subGeometry);
		if (polygon) result.polygons.push(...polygon);
	}

	// Only return if we found at least one geometry
	if (result.points.length === 0 && result.lines.length === 0 && result.polygons.length === 0) {
		return null;
	}

	return result;
}


function findGeoMatch(
	x: number,
	y: number,
	features: GeoJSONFeature[],
	nameField: string,
): string | null {
	const pt = point([x, y]);

	for (const feature of features) {
		try {
			if (
				feature.geometry &&
				booleanPointInPolygon(
					pt,
					feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon,
				)
			) {
				return (feature.properties[nameField] as string) || null;
			}
		} catch {
			// Skip invalid geometries
		}
	}

	return null;
}

function enrichWithGeoData(
	properties: Record<string, unknown>[],
	geoLookup: GeoLookup | null,
	datasetName: string,
): Record<string, unknown>[] {
	if (!geoLookup) return properties;

	// GDH geo-lookup datasets niet verrijken met zichzelf
	if ((GDH_GEO_LOOKUP_DATASETS as readonly string[]).includes(datasetName)) {
		return properties;
	}

	const sample = properties[0];
	if (!sample) return properties;

	const hasRdCoords = "RD_X" in sample && "RD_Y" in sample;
	const hasXY = ("X" in sample && "Y" in sample) || ("x" in sample && "y" in sample);
	const xyLooksLikeRd = hasXY && (sample.X as number) > 1000;

	if (!hasRdCoords && !xyLooksLikeRd) {
		return properties;
	}

	const hasGeoFields = "STADSDEEL" in sample || "stadsdeel" in sample;
	if (hasGeoFields) {
		return properties;
	}

	return properties.map((item) => {
		let x: number;
		let y: number;

		if ("RD_X" in item && "RD_Y" in item) {
			x = item.RD_X as number;
			y = item.RD_Y as number;
		} else {
			x = (item.X ?? item.x) as number;
			y = (item.Y ?? item.y) as number;
		}

		if (typeof x !== "number" || typeof y !== "number") {
			return item;
		}

		const stadsdeel = findGeoMatch(x, y, geoLookup.stadsdelen, "STADSDEELNAAM");
		const wijk = findGeoMatch(x, y, geoLookup.wijken, "WIJKNAAM");
		const buurt = findGeoMatch(x, y, geoLookup.buurten, "BUURTNAAM");

		const needsLatLng = !("lat" in item) || !("lng" in item);
		const latLng = needsLatLng ? rdToWgs84(x, y) : {};
		const needsRdCoords = !("RD_X" in item) || !("RD_Y" in item);
		const rdCoords = needsRdCoords ? { RD_X: x, RD_Y: y } : {};

		return {
			...item,
			...rdCoords,
			...latLng,
			stadsdeel,
			wijk,
			buurt,
		};
	});
}

export function haalGdhSchemaOp(
	data: Record<string, unknown>[],
	name: string,
): Record<string, unknown> {
	const gdhSchema = haalGdhDatasetSchemaOp(name);
	if (gdhSchema) {
		return converteerNaarJsonSchema(gdhSchema);
	}
	return infereerDynamischSchema(data, name);
}

function infereerDynamischSchema(
	data: Record<string, unknown>[],
	name: string,
): Record<string, unknown> {
	const properties: Record<string, unknown> = {};
	const required: string[] = [];

	const keyTypes = new Map<string, Set<string>>();
	const keyValues = new Map<string, Set<unknown>>();

	for (const item of data) {
		for (const [key, value] of Object.entries(item)) {
			if (!keyTypes.has(key)) {
				keyTypes.set(key, new Set());
				keyValues.set(key, new Set());
			}

			const types = keyTypes.get(key)!;
			const values = keyValues.get(key)!;

			if (value === null) {
				types.add("null");
			} else if (typeof value === "number") {
				types.add(Number.isInteger(value) ? "integer" : "number");
			} else if (typeof value === "string") {
				types.add("string");
				if (values.size < 50) {
					values.add(value);
				}
			} else if (typeof value === "boolean") {
				types.add("boolean");
			} else if (Array.isArray(value)) {
				types.add("array");
			} else {
				types.add("object");
			}
		}
	}

	for (const [key, types] of keyTypes) {
		const typeArray = Array.from(types).filter((t) => t !== "null");
		const isNullable = types.has("null");
		const values = keyValues.get(key)!;

		const prop: Record<string, unknown> = {};

		let baseType: string;
		if (typeArray.length === 1) {
			baseType = typeArray[0];
		} else if (typeArray.length > 1) {
			baseType = typeArray.includes("string") ? "string" : typeArray[0];
		} else {
			baseType = "null";
		}

		prop.type = isNullable && baseType !== "null" ? [baseType, "null"] : baseType;

		if (baseType === "string" && values.size > 0 && values.size <= 30) {
			const enumValues = Array.from(values).sort();
			prop.enum = isNullable ? [...enumValues, null] : enumValues;
		}

		properties[key] = prop;

		if (!isNullable) {
			required.push(key);
		}
	}

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		title: name,
		type: "array",
		items: {
			type: "object",
			properties,
			required: required.sort(),
		},
	};
}

export const inferJsonSchema = infereerDynamischSchema;


function isGeoJSONCollection(data: unknown): data is GeoJSONCollection {
	return (
		typeof data === "object" &&
		data !== null &&
		"type" in data &&
		(data as Record<string, unknown>).type === "FeatureCollection" &&
		"features" in data &&
		Array.isArray((data as Record<string, unknown>).features)
	);
}

export function transformGeoJSON(
	data: GeoJSONCollection | Record<string, unknown>[] | unknown,
	datasetName: string,
	geoLookup: GeoLookup | null = null,
): TransformResult {
	let records: Record<string, unknown>[];

	if (isGeoJSONCollection(data)) {
		records = data.features.map((f) => {
			const props = cleanProperties(f.properties);

			if (f.geometry) {
				// Point
				const coords = extractCoordinatesFromGeometry(f.geometry);
				if (coords) {
					props.RD_X = coords.RD_X;
					props.RD_Y = coords.RD_Y;
					props.lat = coords.lat;
					props.lng = coords.lng;
				}

				// MultiPoint
				const multipoint = extractMultiPointFromGeometry(f.geometry);
				if (multipoint) {
					props.multipoint = multipoint;
				}

				// Polygon / MultiPolygon
				const polygon = extractPolygonFromGeometry(f.geometry);
				if (polygon) {
					props.polygon = polygon;
				}

				// LineString / MultiLineString
				const line = extractLineFromGeometry(f.geometry);
				if (line) {
					props.line = line;
				}

				// GeometryCollection
				const collection = extractGeometryCollection(f.geometry);
				if (collection) {
					if (collection.points.length > 0) {
						props.collectionPoints = collection.points;
					}
					if (collection.lines.length > 0) {
						props.collectionLines = collection.lines;
					}
					if (collection.polygons.length > 0) {
						props.collectionPolygons = collection.polygons;
					}
				}
			}

			return props;
		});
	} else if (Array.isArray(data)) {
		records = data.map((item) => {
			if (typeof item === "object" && item !== null) {
				return cleanProperties(item as Record<string, unknown>);
			}
			return { value: item };
		});
	} else if (typeof data === "object" && data !== null) {
		records = [cleanProperties(data as Record<string, unknown>)];
	} else {
		throw new Error(`Unsupported data format: ${typeof data}`);
	}

	records = enrichWithGeoData(records, geoLookup, datasetName);

	// Gebruik hardcoded GDH schema indien beschikbaar
	const schema = haalGdhSchemaOp(records, datasetName);

	return { records, schema };
}

export function createGeoLookup(
	wijken: GeoJSONCollection | null,
	buurten: GeoJSONCollection | null,
	stadsdelen: GeoJSONCollection | null,
): GeoLookup {
	return {
		wijken: wijken?.features ?? [],
		buurten: buurten?.features ?? [],
		stadsdelen: stadsdelen?.features ?? [],
	};
}

// Geometry Building (for database insertion)

export function buildGeometry(record: Record<string, unknown>): string | null {
	// Polygon / MultiPolygon
	if ("polygon" in record && Array.isArray(record.polygon)) {
		const rings = record.polygon as Array<Array<{ lat: number; lng: number }>>;
		if (rings.length === 0) return null;

		if (rings.length === 1) {
			const ring = rings[0];
			const coords = ring.map((p) => `${p.lng} ${p.lat}`).join(", ");
			return `SRID=4326;POLYGON((${coords}))`;
		}

		const polygons = rings.map((ring) => {
			const coords = ring.map((p) => `${p.lng} ${p.lat}`).join(", ");
			return `((${coords}))`;
		});
		return `SRID=4326;MULTIPOLYGON(${polygons.join(", ")})`;
	}

	// LineString / MultiLineString
	if ("line" in record && Array.isArray(record.line)) {
		const lines = record.line as Array<Array<{ lat: number; lng: number }>>;
		if (lines.length === 0) return null;

		if (lines.length === 1) {
			const line = lines[0];
			const coords = line.map((p) => `${p.lng} ${p.lat}`).join(", ");
			return `SRID=4326;LINESTRING(${coords})`;
		}

		const linestrings = lines.map((line) => {
			const coords = line.map((p) => `${p.lng} ${p.lat}`).join(", ");
			return `(${coords})`;
		});
		return `SRID=4326;MULTILINESTRING(${linestrings.join(", ")})`;
	}

	// MultiPoint
	if ("multipoint" in record && Array.isArray(record.multipoint)) {
		const points = record.multipoint as Array<{ lat: number; lng: number }>;
		if (points.length === 0) return null;

		const coords = points.map((p) => `${p.lng} ${p.lat}`).join(", ");
		return `SRID=4326;MULTIPOINT(${coords})`;
	}

	// Point
	if ("lat" in record && "lng" in record) {
		const lat = record.lat as number;
		const lng = record.lng as number;
		if (typeof lat === "number" && typeof lng === "number") {
			return `SRID=4326;POINT(${lng} ${lat})`;
		}
	}

	return null;
}
