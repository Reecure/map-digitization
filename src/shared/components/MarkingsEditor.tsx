'use client'
// components/MarkingsEditor.tsx

import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import maplibregl from 'maplibre-gl'
import type {Map as MaplibreMap, GeoJSONSource, MapMouseEvent, StyleSpecification} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type {Feature, FeatureCollection, Geometry, Position} from 'geojson'
import {
    TOOLS, CATEGORIES, toolById, fieldsForKind, DIRS,
    PALETTE as C, type ToolSpec, type FieldSpec,
} from '@/lib/markings/schema'
import {
    buildMarkingLayers, registerImages, KIND_LAYERS, OPACITY_TARGETS, islandOpacity,
} from '@/lib/markings/layers'

/* ─── types ─── */
export interface MarkingProps {
    _id: number
    kind: string
    style?: string
    width_m?: number
    dir?: string
    bearing?: number
    code?: string
}
type MF = Feature<Geometry, MarkingProps>
type LngLat = {lng: number; lat: number}

const EMPTY: FeatureCollection = {type: 'FeatureCollection', features: []}
const BASEMAPS = [['esri', 'Esri'], ['google', 'Google'], ['osm', 'OSM'], ['none', 'Темна']] as const
const LIST_LIMIT = 200

/* ─── helpers ─── */
const bearingBetween = (a: LngLat, b: LngLat): number => {
    const r = (d: number) => (d * Math.PI) / 180
    const y = Math.sin(r(b.lng - a.lng)) * Math.cos(r(b.lat))
    const x = Math.cos(r(a.lat)) * Math.sin(r(b.lat)) -
        Math.sin(r(a.lat)) * Math.cos(r(b.lat)) * Math.cos(r(b.lng - a.lng))
    return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360)
}

const featureAnchor = (f: MF): Position => {
    const g = f.geometry
    if (g.type === 'Point') return g.coordinates
    if (g.type === 'LineString') return g.coordinates[0]
    if (g.type === 'Polygon') return g.coordinates[0][0]
    return [0, 0]
}

const featureVertices = (f: MF): Position[] => {
    const g = f.geometry
    if (g.type === 'Point') return [g.coordinates]
    if (g.type === 'LineString') return g.coordinates
    if (g.type === 'Polygon') return g.coordinates[0].slice(0, -1)
    return []
}

/** середини сегментів: [позиція, індекс вставки] */
const featureMidpoints = (f: MF): Array<[Position, number]> => {
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

/* маленькі SVG-іконки напрямків стрілок */
const DIR_PATHS: Record<string, string> = {
    through: 'M12 20V7M12 4l-4 5h8z',
    left: 'M12 20v-8c0-2 -1-3 -3-3H7M8 12L4 9l4-3',
    right: 'M12 20v-8c0-2 1-3 3-3h2M16 12l4-3-4-3',
    through_left: 'M12 20V7M12 4l-3 4h6zM11 13c-2 0-3-1-4-1H6M7.5 14.5L4 12l3.5-2.5',
    through_right: 'M12 20V7M12 4l-3 4h6zM13 13c2 0 3-1 4-1h1M16.5 14.5L20 12l-3.5-2.5',
}
const DirIcon = ({dir}: {dir: string}) => (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
        <path d={DIR_PATHS[dir]}/>
    </svg>
)

const EyeIcon = ({off}: {off: boolean}) => (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none"
         stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {off
            ? <><path d="M3 3l18 18M10.5 5.2A9.8 9.8 0 0 1 12 5c5 0 9 4.5 10 7-.4 1-1.3 2.4-2.6 3.7M6.6 6.6C4.1 8.1 2.5 10.4 2 12c1 2.5 5 7 10 7 1.5 0 2.9-.4 4.2-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></>
            : <><path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z"/><circle cx="12" cy="12" r="3"/></>}
    </svg>
)

/* ═══════════════ component ═══════════════ */
export default function MarkingsEditor() {
    const mapRef = useRef<MaplibreMap | null>(null)
    const containerRef = useRef<HTMLDivElement | null>(null)

    /* стан для рендера (у JSX — ТІЛЬКИ він, ніяких refs) */
    const [features, setFeatures] = useState<MF[]>([])
    const [toolId, setToolId] = useState<string | null>(null)
    const [selectedId, setSelectedId] = useState<number | null>(null)
    const [basemap, setBasemap] = useState<string>('esri')
    const [saving, setSaving] = useState(false)
    const [step, setStep] = useState(0)
    const [fillOpacity, setFillOpacity] = useState(100)
    const [hiddenKinds, setHiddenKinds] = useState<Set<string>>(new Set())
    const [query, setQuery] = useState('')
    const [mapReady, setMapReady] = useState(false)

    /* дзеркала для обробників карти (оновлюються ефектами, у рендері не читаються) */
    const featuresRef = useRef<MF[]>(features)
    const toolIdRef = useRef<string | null>(toolId)
    const selectedIdRef = useRef<number | null>(selectedId)
    useEffect(() => { featuresRef.current = features }, [features])
    useEffect(() => { toolIdRef.current = toolId }, [toolId])
    useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

    /* транзієнтний стан малювання — не викликає рендерів */
    const draw = useRef<{
        pts: Position[]
        pendingPoint: Position | null
        drag: {fid: number; vi: number} | null
        raf: number
        uid: number
    }>({pts: [], pendingPoint: null, drag: null, raf: 0, uid: 1})

    /* ─── map plumbing ─── */
    const setSourceData = useCallback((id: string, data: FeatureCollection | Feature) => {
        const s = mapRef.current?.getSource(id) as GeoJSONSource | undefined
        s?.setData(data)
    }, [])

    const pushToMap = useCallback((list: MF[]) => {
        setSourceData('markings', {type: 'FeatureCollection', features: list})
    }, [setSourceData])

    const renderEditPts = useCallback((list: MF[], selId: number | null, tool: string | null) => {
        const f = list.find(x => x.properties._id === selId)
        const active = f && !tool
        const pts = active ? featureVertices(f) : []
        const mids = active ? featureMidpoints(f) : []
        setSourceData('editpts', {
            type: 'FeatureCollection',
            features: pts.map((c, i) => ({
                type: 'Feature', properties: {vi: i}, geometry: {type: 'Point', coordinates: c},
            })),
        })
        setSourceData('editmids', {
            type: 'FeatureCollection',
            features: mids.map(([c, insertAt]) => ({
                type: 'Feature', properties: {insertAt}, geometry: {type: 'Point', coordinates: c},
            })),
        })
    }, [setSourceData])

    const setDraft = useCallback((geom: Geometry | null) => {
        setSourceData('draft', geom
            ? {type: 'Feature', properties: {}, geometry: geom}
            : EMPTY)
    }, [setSourceData])

    /* ─── синхронізація стану → карта ─── */
    useEffect(() => { pushToMap(features) }, [features, pushToMap])
    useEffect(() => {
        mapRef.current?.setFilter('sel', ['==', ['get', '_id'], selectedId ?? -1])
        renderEditPts(features, selectedId, toolId)
    }, [selectedId, features, toolId, renderEditPts])

    /* прозорість полотна */
    useEffect(() => {
        const m = mapRef.current
        if (!m || !mapReady) return
        const k = fillOpacity / 100
        Object.entries(OPACITY_TARGETS).forEach(([id, base]) =>
            m.getLayer(id) && m.setPaintProperty(id, 'fill-opacity', base * k))
        if (m.getLayer('rm-island')) m.setPaintProperty('rm-island', 'fill-opacity', islandOpacity(k))
    }, [fillOpacity, mapReady])

    /* видимість по kind */
    useEffect(() => {
        const m = mapRef.current
        if (!m || !mapReady) return
        Object.entries(KIND_LAYERS).forEach(([kind, ids]) =>
            ids.forEach(id => m.getLayer(id) &&
                m.setLayoutProperty(id, 'visibility', hiddenKinds.has(kind) ? 'none' : 'visible')))
    }, [hiddenKinds, mapReady])

    /* підкладка */
    useEffect(() => {
        const m = mapRef.current
        if (!m || !mapReady) return
            ;['esri', 'google', 'osm'].forEach(b =>
            m.getLayer('base-' + b) &&
            m.setLayoutProperty('base-' + b, 'visibility', b === basemap ? 'visible' : 'none'))
    }, [basemap, mapReady])

    /* ─── створення фіч ─── */
    const createFeature = useCallback((geometry: Geometry, tool: ToolSpec, extra: Partial<MarkingProps> = {}) => {
        const props: MarkingProps = {
            _id: draw.current.uid++,
            kind: tool.kind,
            ...(tool.presetProps as Partial<MarkingProps>),
            ...extra,
        }
        tool.fields.forEach(f => {
            const key = f.name
            if (f.default !== undefined && props[key] === undefined)
                (props as unknown as Record<string, unknown>)[key] = f.default
        })
        setFeatures(prev => [...prev, {type: 'Feature', properties: props, geometry}])
        setSelectedId(props._id)
    }, [])

    const finishDrawing = useCallback(() => {
        const tool = toolById(toolIdRef.current ?? '')
        const pts = draw.current.pts
        draw.current.pts = []
        setDraft(null)
        setStep(0)
        if (!tool) return
        if (tool.geometry === 'polygon' && pts.length >= 3)
            createFeature({type: 'Polygon', coordinates: [[...pts, pts[0]]]}, tool)
        else if (tool.geometry === 'line' && pts.length >= 2)
            createFeature({type: 'LineString', coordinates: pts}, tool)
    }, [createFeature, setDraft])

    /* ─── init map (once) ─── */
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return

        const style: StyleSpecification = {
            version: 8,
            glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
            sources: {
                markings: {type: 'geojson', data: EMPTY},
                draft: {type: 'geojson', data: EMPTY},
                editpts: {type: 'geojson', data: EMPTY},
                editmids: {type: 'geojson', data: EMPTY},
                'base-esri': {
                    type: 'raster', tileSize: 256, attribution: 'Esri', maxzoom: 19,
                    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                },
                'base-google': {
                    type: 'raster', tileSize: 256, attribution: 'Google', maxzoom: 21,
                    tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
                },
                'base-osm': {
                    type: 'raster', tileSize: 256, attribution: 'OpenStreetMap', maxzoom: 19,
                    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                },
            },
            layers: [
                {id: 'bg', type: 'background', paint: {'background-color': C.bg}},
                {id: 'base-esri', type: 'raster', source: 'base-esri', paint: {'raster-opacity': .92}},
                {id: 'base-google', type: 'raster', source: 'base-google', layout: {visibility: 'none'}, paint: {'raster-opacity': .92}},
                {id: 'base-osm', type: 'raster', source: 'base-osm', layout: {visibility: 'none'}, paint: {'raster-opacity': .75}},
                ...buildMarkingLayers('markings'),
                {id: 'hit-fill', type: 'fill', source: 'markings',
                    filter: ['==', ['geometry-type'], 'Polygon'], paint: {'fill-color': '#000', 'fill-opacity': .01}},
                {id: 'hit-line', type: 'line', source: 'markings',
                    filter: ['==', ['geometry-type'], 'LineString'], paint: {'line-color': '#000', 'line-opacity': .01, 'line-width': 14}},
                {id: 'hit-pt', type: 'circle', source: 'markings',
                    filter: ['==', ['geometry-type'], 'Point'], paint: {'circle-color': '#000', 'circle-opacity': .01, 'circle-radius': 14}},
                {id: 'sel', type: 'line', source: 'markings', filter: ['==', ['get', '_id'], -1],
                    paint: {'line-color': C.accent, 'line-width': 2, 'line-dasharray': [2, 2]}},
                {id: 'draft-fill', type: 'fill', source: 'draft',
                    filter: ['==', ['geometry-type'], 'Polygon'], paint: {'fill-color': C.accent, 'fill-opacity': .15}},
                {id: 'draft-line', type: 'line', source: 'draft', paint: {'line-color': C.accent, 'line-width': 2}},
                {id: 'editmids-l', type: 'circle', source: 'editmids',
                    paint: {'circle-radius': 3.5, 'circle-color': C.accent, 'circle-opacity': .35,
                        'circle-stroke-color': C.accent, 'circle-stroke-width': 1, 'circle-stroke-opacity': .5}},
                {id: 'editpts-l', type: 'circle', source: 'editpts',
                    paint: {'circle-radius': 5, 'circle-color': C.bg, 'circle-stroke-color': C.accent, 'circle-stroke-width': 2}},
            ],
        }

        const map = new maplibregl.Map({
            container: containerRef.current,
            center: [30.4487, 50.4735], zoom: 16.5, maxZoom: 22, hash: true, style,
        })
        mapRef.current = map
        map.addControl(new maplibregl.NavigationControl())
        map.doubleClickZoom.disable()

        map.on('error', ev => {
            // німих чорних екранів більше нема: все у консоль
            console.error('[markings-editor] map error:', ev.error ?? ev)
        })
        map.on('load', () => {
            setMapReady(true)
            registerImages(map)
            fetch('/api/markings')
                .then(r => (r.ok ? r.json() : EMPTY))
                .then((d: FeatureCollection) => {
                    const list = (d.features ?? []).map(f => ({
                        ...f,
                        properties: {...(f.properties ?? {}), _id: draw.current.uid++} as MarkingProps,
                    })) as MF[]
                    setFeatures(list)
                })
                .catch(() => undefined)
        })

        map.on('click', (e: MapMouseEvent) => {
            const d = draw.current
            const tool = toolById(toolIdRef.current ?? '')

            if (d.pendingPoint && tool?.twoClickBearing) {
                const [lng, lat] = d.pendingPoint
                const bearing = bearingBetween({lng, lat}, e.lngLat)
                createFeature({type: 'Point', coordinates: d.pendingPoint}, tool, {bearing})
                d.pendingPoint = null
                setDraft(null)
                setStep(0)
                return
            }
            if (tool?.geometry === 'point') {
                if (tool.twoClickBearing) {
                    d.pendingPoint = [e.lngLat.lng, e.lngLat.lat]
                    setStep(1)
                } else {
                    createFeature({type: 'Point', coordinates: [e.lngLat.lng, e.lngLat.lat]}, tool)
                }
                return
            }
            if (tool) {
                d.pts.push([e.lngLat.lng, e.lngLat.lat])
                setStep(s => Math.min(Math.max(s, d.pts.length - 1), tool.hint.length - 1))
                return
            }
            const hits = map.queryRenderedFeatures(e.point, {layers: ['hit-pt', 'hit-line', 'hit-fill']})
            const id = hits.length ? (hits[0].properties as MarkingProps)._id : null
            setSelectedId(id)
        })

        map.on('dblclick', e => { e.preventDefault(); finishDrawing() })

        map.on('mousemove', e => {
            const d = draw.current
            const tool = toolById(toolIdRef.current ?? '')
            if (d.pendingPoint) {
                setDraft({type: 'LineString', coordinates: [d.pendingPoint, [e.lngLat.lng, e.lngLat.lat]]})
                return
            }
            if (tool && d.pts.length) {
                const pts: Position[] = [...d.pts, [e.lngLat.lng, e.lngLat.lat]]
                setDraft(tool.geometry === 'polygon' && pts.length >= 3
                    ? {type: 'Polygon', coordinates: [[...pts, pts[0]]]}
                    : {type: 'LineString', coordinates: pts})
                return
            }
            if (d.drag) {
                const f = featuresRef.current.find(x => x.properties._id === d.drag!.fid)
                if (!f) return
                const c: Position = [e.lngLat.lng, e.lngLat.lat]
                const g = f.geometry
                if (g.type === 'Point') g.coordinates = c
                else if (g.type === 'LineString') g.coordinates[d.drag.vi] = c
                else if (g.type === 'Polygon') {
                    const ring = g.coordinates[0]
                    ring[d.drag.vi] = c
                    ring[ring.length - 1] = ring[0]
                }
                /* rAF-тротлінг: не частіше кадру, без React-рендера */
                if (!d.raf) d.raf = requestAnimationFrame(() => {
                    d.raf = 0
                    pushToMap(featuresRef.current)
                    renderEditPts(featuresRef.current, selectedIdRef.current, toolIdRef.current)
                })
            }
        })

        map.on('mousedown', 'editpts-l', e => {
            e.preventDefault()
            const vi = (e.features?.[0]?.properties as {vi: number}).vi
            draw.current.drag = {fid: selectedIdRef.current as number, vi}
            map.getCanvas().style.cursor = 'grabbing'
        })
        map.on('mousedown', 'editmids-l', e => {
            e.preventDefault()
            const insertAt = (e.features?.[0]?.properties as {insertAt: number}).insertAt
            const selId = selectedIdRef.current
            const f = featuresRef.current.find(x => x.properties._id === selId)
            if (!f) return
            const c: Position = [e.lngLat.lng, e.lngLat.lat]
            const g = f.geometry
            if (g.type === 'LineString') g.coordinates.splice(insertAt, 0, c)
            else if (g.type === 'Polygon') g.coordinates[0].splice(insertAt, 0, c)
            else return
            draw.current.drag = {fid: selId as number, vi: insertAt}
            map.getCanvas().style.cursor = 'grabbing'
            pushToMap(featuresRef.current)
            renderEditPts(featuresRef.current, selId, toolIdRef.current)
        })
        map.on('mouseenter', 'editmids-l', () => {
            if (!draw.current.drag) map.getCanvas().style.cursor = 'copy'
        })
        map.on('mouseleave', 'editmids-l', () => {
            if (!draw.current.drag) map.getCanvas().style.cursor = ''
        })
        map.on('mouseup', () => {
            if (draw.current.drag) {
                draw.current.drag = null
                map.getCanvas().style.cursor = ''
                setFeatures(prev => [...prev]) // commit транзієнтних мутацій у стан
            }
        })
        map.on('contextmenu', 'editpts-l', e => {
            e.preventDefault()
            const selId = selectedIdRef.current
            const vi = (e.features?.[0]?.properties as {vi: number}).vi
            setFeatures(prev => prev.map(f => {
                if (f.properties._id !== selId) return f
                const g = f.geometry
                if (g.type === 'LineString' && g.coordinates.length > 2) {
                    const coords = g.coordinates.filter((_, i) => i !== vi)
                    return {...f, geometry: {type: 'LineString', coordinates: coords}}
                }
                if (g.type === 'Polygon' && g.coordinates[0].length > 4) {
                    const ring = g.coordinates[0].slice(0, -1).filter((_, i) => i !== vi)
                    return {...f, geometry: {type: 'Polygon', coordinates: [[...ring, ring[0]]]}}
                }
                return f
            }))
        })

        const onKey = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement | null)?.tagName
            if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
            if (e.key === 'Escape') {
                draw.current.pts = []
                draw.current.pendingPoint = null
                setDraft(null)
                setStep(0)
                setToolId(null)
                map.getCanvas().style.cursor = ''
            }
            if (e.key === 'Enter') finishDrawing()
            if (e.key === 'Backspace' && draw.current.pts.length) {
                e.preventDefault()
                draw.current.pts.pop()
                setDraft(draw.current.pts.length >= 2
                    ? {type: 'LineString', coordinates: draw.current.pts}
                    : null)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => {
            window.removeEventListener('keydown', onKey)
            map.remove()
            mapRef.current = null
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    /* ─── дії UI ─── */
    const pickTool = (id: string) => {
        setToolId(cur => {
            const next = cur === id ? null : id
            draw.current.pts = []
            draw.current.pendingPoint = null
            setDraft(null)
            setStep(0)
            if (mapRef.current) mapRef.current.getCanvas().style.cursor = next ? 'crosshair' : ''
            return next
        })
    }

    const toggleKind = (kind: string) =>
        setHiddenKinds(prev => {
            const next = new Set(prev)
            if (next.has(kind)) next.delete(kind)
            else next.add(kind)
            return next
        })

    const updateProp = (name: keyof MarkingProps, value: string | number | undefined) => {
        setFeatures(prev => prev.map(f => {
            if (f.properties._id !== selectedId) return f
            const props = {...f.properties}
            if (value === '' || value === undefined || (typeof value === 'number' && Number.isNaN(value)))
                delete props[name]
            else (props as unknown as Record<string, unknown>)[name] = value
            return {...f, properties: props}
        }))
    }

    const deleteSelected = () => {
        setFeatures(prev => prev.filter(f => f.properties._id !== selectedId))
        setSelectedId(null)
    }

    const cleanFC = (list: MF[]): FeatureCollection => ({
        type: 'FeatureCollection',
        features: list.map(f => ({
            type: 'Feature',
            properties: Object.fromEntries(
                Object.entries(f.properties).filter(([k]) => k !== '_id')),
            geometry: f.geometry,
        })),
    })

    const saveToProject = async () => {
        setSaving(true)
        try {
            await fetch('/api/markings', {method: 'POST', body: JSON.stringify(cleanFC(features))})
        } finally { setSaving(false) }
    }
    const download = () => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(new Blob([JSON.stringify(cleanFC(features))], {type: 'application/geo+json'}))
        a.download = 'markings.geojson'
        a.click()
    }
    const importFile = (file: File) => file.text().then(t => {
        const d = JSON.parse(t) as FeatureCollection
        const add = (d.features ?? []).map(f => ({
            ...f,
            properties: {...(f.properties ?? {}), _id: draw.current.uid++} as MarkingProps,
        })) as MF[]
        setFeatures(prev => [...prev, ...add])
    })

    const selectAndFly = (f: MF) => {
        setSelectedId(f.properties._id)
        const m = mapRef.current
        if (m) m.flyTo({center: featureAnchor(f) as [number, number], zoom: Math.max(m.getZoom(), 17)})
    }

    /* ─── похідні для рендера ─── */
    const selected = useMemo(
        () => features.find(f => f.properties._id === selectedId) ?? null,
        [features, selectedId])
    const activeTool = toolId ? toolById(toolId) ?? null : null
    const hint = activeTool?.hint ?? []
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        const base = q
            ? features.filter(f => {
                const p = f.properties
                return [p.kind, p.style, p.dir, p.code].filter(Boolean)
                    .some(v => String(v).toLowerCase().includes(q))
            })
            : features
        return base
    }, [features, query])
    const visibleList = filtered.slice(-LIST_LIMIT).reverse()

    /* ═══════════════ UI ═══════════════ */
    return (
        <div className="fixed inset-0 bg-[#0a0c12] text-slate-200 font-sans">
            <style>{`
                .ed-scroll { scrollbar-width: thin; scrollbar-color: rgba(148,163,184,.25) transparent; }
                .ed-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
                .ed-scroll::-webkit-scrollbar-track { background: transparent; }
                .ed-scroll::-webkit-scrollbar-thumb {
                    background: rgba(148,163,184,.22); border-radius: 8px;
                    border: 2px solid #0d1019; background-clip: padding-box;
                }
                .ed-scroll::-webkit-scrollbar-thumb:hover { background: rgba(79,140,255,.55); border: 2px solid #0d1019; background-clip: padding-box; }
                input[type=range].ed-range { -webkit-appearance: none; appearance: none; height: 4px;
                    border-radius: 4px; background: linear-gradient(90deg, #4f8cff var(--p,50%), rgba(255,255,255,.1) var(--p,50%)); }
                input[type=range].ed-range::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px;
                    border-radius: 50%; background: #4f8cff; border: 2px solid #0d1019; box-shadow: 0 0 8px rgba(79,140,255,.6); cursor: pointer; }
            `}</style>

            <link href="https://unpkg.com/maplibre-gl/dist/maplibre-gl.css" rel="stylesheet" />

            <div className="absolute inset-y-0 left-[264px] right-[300px]">
                <div ref={containerRef} className="w-full h-full" />
            </div>

            {/* ── topbar ── */}
            <div className="absolute top-0 left-[264px] right-[300px] z-10 flex items-center gap-3 px-4 h-12
                            bg-[#0a0c12]/80 backdrop-blur border-b border-white/[.06]">
                <span className="text-sm font-semibold tracking-wide">
                    <span className="text-white">Markings</span>{' '}
                    <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">Editor</span>
                </span>
                <span className="text-xs text-slate-500">{features.length} об'єктів</span>
                <div className="ml-auto flex items-center gap-2">
                    <div className="flex rounded-lg border border-white/10 overflow-hidden">
                        {BASEMAPS.map(([id, label]) => (
                            <button key={id} onClick={() => setBasemap(id)}
                                    className={`px-2.5 py-1.5 text-xs transition
                                        ${basemap === id ? 'bg-blue-500/25 text-blue-200' : 'text-slate-400 hover:text-slate-200'}`}>
                                {label}
                            </button>
                        ))}
                    </div>
                    <label className="px-3 py-1.5 rounded-lg text-xs border border-white/10 hover:border-white/25 cursor-pointer">
                        Імпорт
                        <input type="file" accept=".geojson,.json" hidden
                               onChange={e => e.target.files?.[0] && importFile(e.target.files[0])}/>
                    </label>
                    <button onClick={download}
                            className="px-3 py-1.5 rounded-lg text-xs border border-white/10 hover:border-white/25">
                        Експорт
                    </button>
                    <button onClick={saveToProject} disabled={saving}
                            className="px-3 py-1.5 rounded-lg text-xs bg-blue-500 hover:bg-blue-400 text-white
                                       disabled:opacity-50 transition">
                        {saving ? 'Зберігаю…' : 'Зберегти у проєкт'}
                    </button>
                </div>
            </div>

            {/* ── меню інструментів ── */}
            <aside className="absolute inset-y-0 left-0 w-[264px] z-10 flex flex-col
                              bg-[#0d1019] border-r border-white/[.06]">
                <div className="px-5 pt-4 pb-3">
                    <div className="text-[15px] font-semibold text-white">Інструменти</div>
                    <div className="text-xs text-slate-500">Esc — вибір · Enter — завершити</div>
                </div>
                <div className="flex-1 overflow-y-auto ed-scroll px-3 pb-3">
                    {CATEGORIES.map(cat => (
                        <div key={cat} className="mb-4">
                            <div className="px-2 pb-1.5 text-[11px] uppercase tracking-widest text-slate-500">{cat}</div>
                            <div className="space-y-0.5">
                                {TOOLS.filter(t => t.category === cat).map(t => {
                                    const hidden = hiddenKinds.has(t.kind)
                                    return (
                                        <div key={t.id}
                                             className={`group flex items-center gap-1 rounded-xl border transition
                                                ${toolId === t.id
                                                 ? 'bg-blue-500/15 border-blue-500/40'
                                                 : 'border-transparent hover:bg-white/[.04] hover:border-white/[.08]'}`}>
                                            <button onClick={() => pickTool(t.id)}
                                                    className={`flex-1 flex items-center gap-2.5 pl-2.5 py-2 text-left text-[13px]
                                                        ${toolId === t.id ? 'text-blue-200' : hidden ? 'text-slate-600' : ''}`}>
                                                <span className="w-2.5 h-2.5 rounded-full shrink-0"
                                                      style={{background: t.color, boxShadow: `0 0 8px ${t.color}55`, opacity: hidden ? .35 : 1}}/>
                                                <span className="flex-1">{t.label}</span>
                                            </button>
                                            <button onClick={() => toggleKind(t.kind)}
                                                    title={hidden ? 'Показати' : 'Сховати'}
                                                    className={`pr-2.5 py-2 transition
                                                        ${hidden ? 'text-slate-600' : 'text-slate-500 opacity-0 group-hover:opacity-100 hover:text-blue-300'}`}>
                                                <EyeIcon off={hidden}/>
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
                {/* прозорість полотна */}
                <div className="px-5 py-3 border-t border-white/[.06]">
                    <div className="flex items-center justify-between pb-1.5">
                        <span className="text-xs text-slate-500">Прозорість полотна</span>
                        <span className="text-xs tabular-nums text-blue-300">{fillOpacity}%</span>
                    </div>
                    <input type="range" min={10} max={100} step={5} value={fillOpacity}
                           onChange={e => setFillOpacity(Number(e.target.value))}
                           style={{'--p': `${((fillOpacity - 10) / 90) * 100}%`} as React.CSSProperties}
                           className="w-full ed-range"/>
                </div>
            </aside>

            {/* ── поетапна підказка ── */}
            {activeTool && (
                <div className="absolute bottom-4 left-[280px] right-[316px] z-10 flex justify-center pointer-events-none">
                    <div className="max-w-xl w-full rounded-2xl border border-white/[.08] bg-[#10131c]/90
                                    backdrop-blur px-4 py-3 pointer-events-auto">
                        <div className="flex items-center gap-2 pb-1.5">
                            <span className="w-2 h-2 rounded-full" style={{background: activeTool.color}}/>
                            <span className="text-sm font-medium text-white">{activeTool.label}</span>
                        </div>
                        <ol className="space-y-1">
                            {hint.map((h, i) => (
                                <li key={i} className={`flex gap-2 text-xs transition
                                        ${i === Math.min(step, hint.length - 1) ? 'text-blue-300' : 'text-slate-500'}`}>
                                    <span className={`w-4 h-4 rounded-full text-[10px] grid place-items-center shrink-0 border
                                        ${i <= step ? 'border-blue-400/60 text-blue-300' : 'border-white/15 text-slate-600'}`}>
                                        {i + 1}
                                    </span>
                                    {h}
                                </li>
                            ))}
                        </ol>
                    </div>
                </div>
            )}

            {/* ── права панель ── */}
            <aside className="absolute inset-y-0 right-0 w-[300px] z-10 flex flex-col
                              bg-[#0d1019] border-l border-white/[.06]">
                <div className="px-4 pt-4 pb-2 text-[11px] uppercase tracking-widest text-slate-500">Атрибути</div>
                <div className="px-4 pb-4 border-b border-white/[.06]">
                    {!selected ? (
                        <div className="text-xs text-slate-500 py-2">
                            Оберіть об'єкт на карті або інструмент зліва
                        </div>
                    ) : (
                        <AttrForm feature={selected} onChange={updateProp} onDelete={deleteSelected}/>
                    )}
                </div>

                <div className="px-4 pt-3 pb-2 flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-widest text-slate-500">Об'єкти</span>
                    <input value={query} onChange={e => setQuery(e.target.value)} placeholder="пошук…"
                           className="ml-auto w-32 bg-[#151a28] border border-white/10 rounded-lg px-2 py-1
                                      text-xs focus:border-blue-500/60 outline-none"/>
                </div>
                <div className="flex-1 overflow-y-auto ed-scroll px-2 pb-2">
                    {visibleList.map(f => {
                        const p = f.properties
                        const meta = [p.style, p.dir, p.code, p.width_m !== undefined ? `${p.width_m} м` : null]
                            .filter(Boolean).join(' · ')
                        return (
                            <button key={p._id} onClick={() => selectAndFly(f)}
                                    className={`w-full flex justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition
                                        ${p._id === selectedId
                                        ? 'bg-blue-500/15 outline outline-1 outline-blue-500/40'
                                        : 'hover:bg-white/[.04]'}`}>
                                <span className="text-[13px]">{p.kind}</span>
                                <span className="text-xs text-slate-500 truncate">{meta}</span>
                            </button>
                        )
                    })}
                    {filtered.length > LIST_LIMIT && (
                        <div className="text-[11px] text-slate-600 px-2.5 py-2">
                            Показано останні {LIST_LIMIT} з {filtered.length} — звузьте пошуком
                        </div>
                    )}
                    {!features.length && (
                        <div className="text-xs text-slate-600 px-2.5 py-2">
                            Порожньо — оберіть інструмент і малюйте
                        </div>
                    )}
                </div>
            </aside>
        </div>
    )
}

/* ─── форма атрибутів ─── */
function AttrForm({feature, onChange, onDelete}: {
    feature: MF
    onChange: (name: keyof MarkingProps, value: string | number | undefined) => void
    onDelete: () => void
}) {
    const p = feature.properties
    const fields: FieldSpec[] = fieldsForKind(p.kind)
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">{p.kind}</span>
                <button onClick={onDelete} className="text-xs text-red-400/80 hover:text-red-300">Видалити</button>
            </div>
            {fields.map(fl => {
                const raw = p[fl.name]
                const v = raw ?? ''
                if (fl.type === 'dir') return (
                    <div key={fl.name}>
                        <div className="text-xs text-slate-500 pb-1.5">{fl.label}</div>
                        <div className="grid grid-cols-5 gap-1">
                            {DIRS.map(d => (
                                <button key={d} title={d} onClick={() => onChange('dir', d)}
                                        className={`h-9 rounded-lg grid place-items-center border transition
                                            ${v === d ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                                            : 'border-white/10 text-slate-400 hover:border-white/25'}`}>
                                    <DirIcon dir={d}/>
                                </button>
                            ))}
                        </div>
                    </div>
                )
                if (fl.type === 'bearing') return (
                    <div key={fl.name}>
                        <div className="flex items-center justify-between pb-1.5">
                            <span className="text-xs text-slate-500">{fl.label}{fl.required && ' *'}</span>
                            <span className="text-xs tabular-nums text-blue-300">{v === '' ? '—' : `${v}°`}</span>
                        </div>
                        <input type="range" min={0} max={359} step={1}
                               value={v === '' ? 0 : Number(v)}
                               onChange={e => onChange('bearing', Number(e.target.value))}
                               style={{'--p': `${((v === '' ? 0 : Number(v)) / 359) * 100}%`} as React.CSSProperties}
                               className="w-full ed-range"/>
                        <div className="flex gap-1 pt-1.5">
                            {([['Пн', 0], ['Сх', 90], ['Пд', 180], ['Зх', 270]] as const).map(([l, deg]) => (
                                <button key={l} onClick={() => onChange('bearing', deg)}
                                        className="flex-1 py-1 rounded-md text-[11px] border border-white/10
                                                   text-slate-400 hover:border-white/25">
                                    {l}
                                </button>
                            ))}
                        </div>
                    </div>
                )
                if (fl.type === 'select') return (
                    <div key={fl.name}>
                        <div className="text-xs text-slate-500 pb-1.5">{fl.label}{fl.required && ' *'}</div>
                        <select value={String(v)}
                                onChange={e => onChange(fl.name, e.target.value)}
                                className="w-full bg-[#151a28] border border-white/10 rounded-lg
                                           px-2.5 py-2 text-sm focus:border-blue-500/60 outline-none">
                            {(fl.options ?? []).map(o => <option key={o} value={o}>{o || '—'}</option>)}
                        </select>
                    </div>
                )
                return (
                    <div key={fl.name}>
                        <div className="text-xs text-slate-500 pb-1.5">{fl.label}{fl.required && ' *'}</div>
                        <input type={fl.type === 'number' ? 'number' : 'text'} step={0.1} value={String(v)}
                               onChange={e => onChange(fl.name,
                                   fl.type === 'number' ? Number(e.target.value) : e.target.value)}
                               className="w-full bg-[#151a28] border border-white/10 rounded-lg
                                          px-2.5 py-2 text-sm focus:border-blue-500/60 outline-none"/>
                    </div>
                )
            })}
        </div>
    )
}