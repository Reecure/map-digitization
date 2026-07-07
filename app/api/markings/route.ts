import {promises as fs} from 'fs'
import path from 'path'

const FILE = path.join(process.cwd(), 'data', 'markings.geojson')
const EMPTY = JSON.stringify({type: 'FeatureCollection', features: []})

export async function GET() {
    try {
        const text = await fs.readFile(FILE, 'utf-8')
        return new Response(text, {headers: {'content-type': 'application/geo+json'}})
    } catch {
        return new Response(EMPTY, {headers: {'content-type': 'application/geo+json'}})
    }
}

export async function POST(req: Request) {
    const body = await req.text()
    JSON.parse(body)
    await fs.mkdir(path.dirname(FILE), {recursive: true})
    await fs.writeFile(FILE, body, 'utf-8')
    return Response.json({ok: true})
}