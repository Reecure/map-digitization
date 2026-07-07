import type {Feature, FeatureCollection, Geometry} from "geojson";

export interface MarkingProps {
    _id: number
    kind: string
    style?: string
    width_m?: number
    dir?: string
    bearing?: number
    code?: string
}
export type MF = Feature<Geometry, MarkingProps>
export type LngLat = {lng: number; lat: number}

export const EMPTY: FeatureCollection = {type: 'FeatureCollection', features: []}
export const BASEMAPS = [['esri', 'Esri'], ['google', 'Google'], ['osm', 'OSM']] as const

