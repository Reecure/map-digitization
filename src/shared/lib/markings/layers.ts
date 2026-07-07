
import type {Map as MaplibreMap, ExpressionSpecification, LayerSpecification} from 'maplibre-gl'
import {PALETTE as C, DIRS} from './schema'

const LAT = 50.45
const pxm = (z: number) =>
    Math.pow(2, z + 9) / (40075016.686 * Math.cos((LAT * Math.PI) / 180))
const K16 = pxm(16)
const K22 = pxm(22)

const mC = (m: number): ExpressionSpecification =>
    ['interpolate', ['exponential', 2], ['zoom'], 16, m * K16, 22, m * K22]
const mW = (fallback: number): ExpressionSpecification =>
    ['interpolate', ['exponential', 2], ['zoom'],
        16, ['*', ['coalesce', ['get', 'width_m'], fallback], K16],
        22, ['*', ['coalesce', ['get', 'width_m'], fallback], K22]]
const kis = (k: string): ExpressionSpecification => ['==', ['get', 'kind'], k]
const styleIs = (s: string): ExpressionSpecification => ['==', ['get', 'style'], s]
const styleNot = (s: string): ExpressionSpecification => ['!=', ['get', 'style'], s]

export const KIND_LAYERS: Record<string, string[]> = {
    tunnel: ['rm-tunnel', 'rm-tunnel-o'],
    roadbed: ['rm-roadbed', 'rm-curb'],
    bridge: ['rm-bridge', 'rm-bridge-e'],
    median: ['rm-median', 'rm-median-e'],
    green: ['rm-green', 'rm-green-e'],
    tram: ['rm-tram'],
    bus_stop: ['rm-bus-stop'],
    hatch: ['rm-hatch', 'rm-hatch-o'],
    waffle: ['rm-waffle'],
    island: ['rm-island', 'rm-island-o', 'rm-island-od'],
    divider: ['rm-div-d', 'rm-div-s', 'rm-div-2o', 'rm-div-2i'],
    stop_line: ['rm-stop'],
    speed_bump: ['rm-bump', 'rm-bump-d'],
    crosswalk: ['rm-cross'],
    arrow: ['rm-arrows'],
    bus_mark: ['rm-busmark'],
    sign: ['rm-signs'],
    concrete_barrier: ['rm-barrier-outline', 'rm-barrier'],
}

export const OPACITY_TARGETS: Record<string, number> = {
    'rm-roadbed': 1, 'rm-bridge': 1, 'rm-median': 1, 'rm-green': 1,
    'rm-hatch': .9, 'rm-waffle': .9, 'rm-tunnel': .35,
}

export const islandOpacity = (k: number): ExpressionSpecification =>
    ['case', styleIs('dashed'), .35 * k, k]

export function buildMarkingLayers(source: string): LayerSpecification[] {
    const defs = [
        {id: 'rm-tunnel', type: 'fill', filter: kis('tunnel'),
            paint: {'fill-color': C.roadbed, 'fill-opacity': .35}},
        {id: 'rm-tunnel-o', type: 'line', filter: kis('tunnel'),
            paint: {'line-color': C.curb, 'line-width': mC(.35), 'line-dasharray': [4, 3], 'line-opacity': .7}},
        {id: 'rm-roadbed', type: 'fill', filter: kis('roadbed'), paint: {'fill-color': C.roadbed}},
        {id: 'rm-curb', type: 'line', filter: kis('roadbed'), paint: {'line-color': C.curb, 'line-width': mC(.35)}},
        {id: 'rm-bridge', type: 'fill', filter: kis('bridge'), paint: {'fill-color': C.bridge}},
        {id: 'rm-bridge-e', type: 'line', filter: kis('bridge'), paint: {'line-color': C.bridgeEdge, 'line-width': mC(.8)}},
        {id: 'rm-median', type: 'fill', filter: kis('median'), paint: {'fill-color': C.median}},
        {id: 'rm-median-e', type: 'line', filter: kis('median'), paint: {'line-color': C.curb, 'line-width': mC(.25)}},
        {id: 'rm-green', type: 'fill', filter: kis('green'), paint: {'fill-color': C.green}},
        {id: 'rm-green-e', type: 'line', filter: kis('green'), paint: {'line-color': C.curb, 'line-width': mC(.2)}},
        {id: 'rm-tram', type: 'line', filter: kis('tram'),
            paint: {'line-color': C.tram, 'line-width': mC(.08), 'line-gap-width': mC(1.52)}},
        {id: 'rm-bus-stop', type: 'line', filter: kis('bus_stop'),
            paint: {'line-color': C.yellow, 'line-width': mW(3), 'line-dasharray': [.35, .2], 'line-opacity': .8}},
        {id: 'rm-hatch', type: 'fill', filter: kis('hatch'), paint: {'fill-pattern': 'rm-hatch', 'fill-opacity': .9}},
        {id: 'rm-hatch-o', type: 'line', filter: kis('hatch'), paint: {'line-color': C.mark, 'line-width': mC(.15)}},
        {id: 'rm-waffle', type: 'fill', filter: kis('waffle'), paint: {'fill-pattern': 'rm-waffle', 'fill-opacity': .9}},
        {id: 'rm-island', type: 'fill', filter: kis('island'),
            paint: {'fill-color': C.island, 'fill-opacity': islandOpacity(1)}},
        {id: 'rm-island-o', type: 'line', filter: ['all', kis('island'), styleNot('dashed')],
            paint: {'line-color': C.mark, 'line-width': mC(.2)}},
        {id: 'rm-island-od', type: 'line', filter: ['all', kis('island'), styleIs('dashed')],
            paint: {'line-color': C.mark, 'line-width': mC(.15), 'line-dasharray': [4, 4]}},
        {id: 'rm-div-d', type: 'line', filter: ['all', kis('divider'), styleIs('dashed')],
            paint: {'line-color': C.mark, 'line-width': mC(.15), 'line-dasharray': [7, 21]}},
        {id: 'rm-div-s', type: 'line', filter: ['all', kis('divider'), styleIs('solid')],
            paint: {'line-color': C.mark, 'line-width': mC(.15)}},
        {id: 'rm-div-2o', type: 'line', filter: ['all', kis('divider'), styleIs('double')],
            paint: {'line-color': C.mark, 'line-width': mC(.55)}},
        {id: 'rm-div-2i', type: 'line', filter: ['all', kis('divider'), styleIs('double')],
            paint: {'line-color': C.roadbed, 'line-width': mC(.2)}},
        {id: 'rm-stop', type: 'line', filter: kis('stop_line'), paint: {'line-color': C.mark, 'line-width': mW(.5)}},
        {id: 'rm-bump', type: 'line', filter: kis('speed_bump'), paint: {'line-color': C.yellow, 'line-width': mW(.6)}},
        {id: 'rm-bump-d', type: 'line', filter: kis('speed_bump'),
            paint: {'line-color': C.mark, 'line-width': mW(.6), 'line-dasharray': [.8, .8]}},
        {id: 'rm-cross', type: 'line', filter: kis('crosswalk'),
            paint: {'line-color': C.mark, 'line-width': mW(4), 'line-dasharray': [.15, .15], 'line-opacity': .95}},
        {id: 'rm-arrows', type: 'symbol', filter: kis('arrow'),
            layout: {
                'icon-image': ['concat', 'rm-arrow-', ['get', 'dir']],
                'icon-rotate': ['get', 'bearing'],
                'icon-rotation-alignment': 'map', 'icon-pitch-alignment': 'map',
                'icon-allow-overlap': true, 'icon-ignore-placement': true,
                'icon-size': ['interpolate', ['exponential', 2], ['zoom'], 16, 5 * K16 / 128, 22, 5 * K22 / 128],
            }},
        {id: 'rm-busmark', type: 'symbol', filter: kis('bus_mark'),
            layout: {
                'text-field': 'A', 'text-font': ['Noto Sans Regular'],
                'text-rotate': ['get', 'bearing'],
                'text-rotation-alignment': 'map', 'text-pitch-alignment': 'map',
                'text-allow-overlap': true,
                'text-size': ['interpolate', ['exponential', 2], ['zoom'], 16, 2.5 * K16, 22, 2.5 * K22],
            },
            paint: {'text-color': C.mark, 'text-opacity': .9}},
        {id: 'rm-signs', type: 'symbol', filter: kis('sign'),
            layout: {
                'text-field': ['get', 'code'], 'text-font': ['Noto Sans Regular'],
                'text-size': 11, 'text-allow-overlap': true,
            },
            paint: {'text-color': '#0a0c12', 'text-halo-color': '#ffffff', 'text-halo-width': 6}},
        {
            id: 'rm-barrier-outline', type: 'line', filter: kis('concrete_barrier'),
            paint: {
                'line-color': C.curb,
                'line-width': mW(1)
            }
        },
        {
            id: 'rm-barrier', type: 'line', filter: kis('concrete_barrier'),
            paint: {
                'line-color': '#c4c9d6',
                'line-width': mW(0.7)
            }
        },
    ]
    return defs.map(l => ({...l, source})) as LayerSpecification[]
}

/* ── спрайти canvas'ом ── */
function arrowIcon(dir: string): ImageData {
    const W = 96, H = 160
    const cv = document.createElement('canvas')
    cv.width = W; cv.height = H
    const g = cv.getContext('2d')!
    g.strokeStyle = g.fillStyle = C.mark
    g.lineWidth = 14; g.lineCap = 'butt'; g.lineJoin = 'round'
    const cx = W / 2
    const head = (x: number, y: number, a: number) => {
        g.save(); g.translate(x, y); g.rotate(a)
        g.beginPath(); g.moveTo(0, -26); g.lineTo(-19, 8); g.lineTo(19, 8); g.closePath(); g.fill()
        g.restore()
    }
    const stem = (y: number) => { g.beginPath(); g.moveTo(cx, H - 6); g.lineTo(cx, y); g.stroke() }
    const branch = (s: 'left' | 'right') => {
        const sx = s === 'left' ? -1 : 1
        g.beginPath(); g.moveTo(cx, 96); g.quadraticCurveTo(cx, 62, cx + sx * 26, 56); g.stroke()
        head(cx + sx * 34, 54, sx * Math.PI / 2)
    }
    if (dir === 'through') { stem(34); head(cx, 26, 0) }
    if (dir === 'left') { stem(70); branch('left') }
    if (dir === 'right') { stem(70); branch('right') }
    if (dir === 'through_left') { stem(34); head(cx, 26, 0); branch('left') }
    if (dir === 'through_right') { stem(34); head(cx, 26, 0); branch('right') }
    return g.getImageData(0, 0, W, H)
}

function diag(color: string, step: number, both = false): ImageData {
    const S = 44
    const cv = document.createElement('canvas')
    cv.width = cv.height = S
    const g = cv.getContext('2d')!
    g.strokeStyle = color; g.lineWidth = 4; g.globalAlpha = .85
    g.beginPath()
    for (let i = -S; i <= 2 * S; i += step) {
        g.moveTo(i, 0); g.lineTo(i + S, S)
        if (both) { g.moveTo(i + S, 0); g.lineTo(i, S) }
    }
    g.stroke()
    return g.getImageData(0, 0, S, S)
}

export function registerImages(map: MaplibreMap): void {
    DIRS.forEach(d => {
        const id = 'rm-arrow-' + d
        if (map.hasImage(id)) map.removeImage(id)
        map.addImage(id, arrowIcon(d), {pixelRatio: 2})
    })
    if (map.hasImage('rm-hatch')) map.removeImage('rm-hatch')
    map.addImage('rm-hatch', diag(C.mark, 16))
    if (map.hasImage('rm-waffle')) map.removeImage('rm-waffle')
    map.addImage('rm-waffle', diag(C.yellow, 22, true))
}