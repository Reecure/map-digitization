import {Position} from "geojson";
import {LngLat, MF} from "@/src/types";

export const bearingBetween = (a: LngLat, b: LngLat): number => {
    const r = (d: number) => (d * Math.PI) / 180
    const y = Math.sin(r(b.lng - a.lng)) * Math.cos(r(b.lat))
    const x = Math.cos(r(a.lat)) * Math.sin(r(b.lat)) -
        Math.sin(r(a.lat)) * Math.cos(r(b.lat)) * Math.cos(r(b.lng - a.lng))
    return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360)
}

export const featureAnchor = (f: MF): Position => {
    const g = f.geometry
    if (g.type === 'Point') return g.coordinates
    if (g.type === 'LineString') return g.coordinates[0]
    if (g.type === 'Polygon') return g.coordinates[0][0]
    return [0, 0]
}

export const featureVertices = (f: MF): Position[] => {
    const g = f.geometry
    if (g.type === 'Point') return [g.coordinates]
    if (g.type === 'LineString') return g.coordinates
    if (g.type === 'Polygon') return g.coordinates[0].slice(0, -1)
    return []
}

export const featureMidpoints = (f: MF): Array<[Position, number]> => {
    const g = f.geometry
    const mid = (a: Position, b: Position): Position => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    if (g.type === 'LineString')
        return g.coordinates.slice(0, -1).map((c, i) => [mid(c, g.coordinates[i + 1]), i + 1])
    if (g.type === 'Polygon') {
        const ring = g.coordinates[0]
        return ring.slice(0, -1).map((c, i) => [mid(c, ring[i + 1]), i + 1])
    }
    return []
}