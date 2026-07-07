// lib/markings/schema.ts
// Каталог інструментів редактора: категорії, підказки, поля атрибутів.

export type Geometry = 'polygon' | 'line' | 'point'

export type FieldSpec = {
    name: 'style' | 'width_m' | 'dir' | 'bearing' | 'code'
    type: 'select' | 'number' | 'text' | 'bearing' | 'dir'
    options?: string[]
    default?: string | number
    required?: boolean
    label: string
}

export type ToolSpec = {
    id: string
    kind: string
    geometry: Geometry
    label: string
    category: string
    hint: string[]              // поетапна підказка
    color: string               // кружечок у меню
    fields: FieldSpec[]
    presetProps?: Record<string, string | number>
    twoClickBearing?: boolean   // точка ставиться двома кліками: позиція → напрямок
}

export const DIRS = ['through', 'left', 'right', 'through_left', 'through_right'] as const

const W = (d: number, req = false): FieldSpec =>
    ({name: 'width_m', type: 'number', default: d, required: req, label: 'Ширина, м'})
const BEARING: FieldSpec = {name: 'bearing', type: 'bearing', required: true, label: 'Азимут'}

export const TOOLS: ToolSpec[] = [
    // ── Полотно ────────────────────────────────────────────────
    {
        id: 'roadbed', kind: 'roadbed', geometry: 'polygon', category: 'Полотно',
        label: 'Проїжджа частина', color: '#8e99b3', fields: [],
        hint: ['Обведіть асфальт по бордюрах', 'На кутах перехресть — 3–5 вершин на дузі',
            'Сусідні ділянки малюйте з перекриттям 2–5 м', 'Enter / подв. клік — завершити'],
    },
    {
        id: 'bridge', kind: 'bridge', geometry: 'polygon', category: 'Полотно',
        label: 'Міст / шляхопровід', color: '#99a4be', fields: [],
        hint: ['Полігон настилу поверх полотна, тільки прольот',
            'Полотно нижньої дороги під мостом не розривати',
            'Розмітку нижньої дороги обірвіть на краях настилу'],
    },
    {
        id: 'tunnel', kind: 'tunnel', geometry: 'polygon', category: 'Полотно',
        label: 'Тунель', color: '#5d688f', fields: [],
        hint: ['Від порталу до порталу; полотно закінчується на порталі',
            'Трасу беріть з OSM або ведіть прямою — на знімку її не видно',
            'Розмітка всередині не малюється'],
    },
    {
        id: 'median', kind: 'median', geometry: 'polygon', category: 'Полотно',
        label: 'Розділова смуга', color: '#3d4f47', fields: [],
        hint: ['Бетон/бруківка між проїжджими частинами', 'Для газону використовуйте «Зелень»'],
    },
    {
        id: 'green', kind: 'green', geometry: 'polygon', category: 'Полотно',
        label: 'Зелень', color: '#3a5a45', fields: [],
        hint: ['Газони, клумби, трав\'яні трамвайні полотна', 'Рейки поверх зелені малюються інструментом «Трамвай»'],
    },
    {
        id: 'island', kind: 'island', geometry: 'polygon', category: 'Полотно',
        label: 'Острівець (бордюрний)', color: '#aab4cb',
        fields: [{name: 'style', type: 'select', options: ['solid', 'dashed'], default: 'solid', label: 'Контур'}],
        hint: ['Фізичний острівець безпеки по контуру бордюра'],
    },
    {
        id: 'island-dashed', kind: 'island', geometry: 'polygon', category: 'Полотно',
        label: 'Острівець (розміткою)', color: '#aab4cb', presetProps: {style: 'dashed'},
        fields: [{name: 'style', type: 'select', options: ['solid', 'dashed'], default: 'dashed', label: 'Контур'}],
        hint: ['Нанесений фарбою острівець — пунктирний контур зі знімка'],
    },
    {
        id: 'hatch', kind: 'hatch', geometry: 'polygon', category: 'Полотно',
        label: 'Штрихована зона 1.16', color: '#f0f3f8', fields: [],
        hint: ['Зони заборони / напрямні острівці фарбою', 'Штриховку малює стиль — тільки контур'],
    },
    {
        id: 'waffle', kind: 'waffle', geometry: 'polygon', category: 'Полотно',
        label: 'Вафельниця', color: '#e3c04b', fields: [],
        hint: ['Жовта сітка на перехресті — полігон по зоні'],
    },

    // ── Лінії розмітки ────────────────────────────────────────
    {
        id: 'div-dashed', kind: 'divider', geometry: 'line', category: 'Лінії',
        label: 'Переривчаста', color: '#f0f3f8', presetProps: {style: 'dashed'},
        fields: [{name: 'style', type: 'select', options: ['dashed', 'solid', 'double'], default: 'dashed', label: 'Тип'}],
        hint: ['Одна лінія = одна фактична лінія на асфальті',
            'Не заводьте в зону перехрестя (обрив за 10–20 м)',
            'Паралельні смуги — малюйте по черзі, снап допоможе'],
    },
    {
        id: 'div-solid', kind: 'divider', geometry: 'line', category: 'Лінії',
        label: 'Суцільна', color: '#f0f3f8', presetProps: {style: 'solid'},
        fields: [{name: 'style', type: 'select', options: ['dashed', 'solid', 'double'], default: 'solid', label: 'Тип'}],
        hint: ['Крайки та заборонні лінії', 'Не заводьте в зону перехрестя'],
    },
    {
        id: 'div-double', kind: 'divider', geometry: 'line', category: 'Лінії',
        label: 'Подвійна суцільна', color: '#f0f3f8', presetProps: {style: 'double'},
        fields: [{name: 'style', type: 'select', options: ['dashed', 'solid', 'double'], default: 'double', label: 'Тип'}],
        hint: ['Осьова багатосмугових доріг'],
    },
    {
        id: 'stop_line', kind: 'stop_line', geometry: 'line', category: 'Лінії',
        label: 'Стоп-лінія', color: '#f0f3f8', fields: [W(0.5)],
        hint: ['Дві точки поперек смуг ОДНОГО напрямку', 'Від крайки до осьової, ~1 м до переходу'],
    },
    {
        id: 'give_way', kind: 'give_way', geometry: 'line', category: 'Лінії',
        label: 'Поступись 1.13', color: '#f0f3f8', fields: [W(0.5)],
        hint: ['Там, де на асфальті трикутники поперек смуги'],
    },
    {
        id: 'crosswalk', kind: 'crosswalk', geometry: 'line', category: 'Лінії',
        label: 'Зебра', color: '#f0f3f8', fields: [W(4, true)],
        hint: ['ВІСЬ переходу поперек дороги: бордюр → бордюр',
            'width_m = глибина переходу зі знімка (3–4 м)',
            'Смуги зебри малює стиль сам'],
    },
    {
        id: 'speed_bump', kind: 'speed_bump', geometry: 'line', category: 'Лінії',
        label: 'Лежачий поліцейський', color: '#e3c04b', fields: [W(0.6)],
        hint: ['Вісь поперек дороги, width_m = глибина'],
    },

    // ── Транспорт ─────────────────────────────────────────────
    {
        id: 'bus_lane', kind: 'bus_lane', geometry: 'line', category: 'Транспорт',
        label: 'Смуга ГТ', color: '#b8434f', fields: [W(3.5)],
        hint: ['Вісь смуги ВЗДОВЖ руху', 'Тонування і літери «А» вздовж — стиль сам'],
    },
    {
        id: 'bus_stop', kind: 'bus_stop', geometry: 'line', category: 'Транспорт',
        label: 'Зона зупинки 1.17', color: '#e3c04b', fields: [W(3)],
        hint: ['Лінія вздовж борта по довжині зупинного кармана'],
    },
    {
        id: 'tram', kind: 'tram', geometry: 'line', category: 'Транспорт',
        label: 'Трамвайна колія', color: '#5d6884', fields: [],
        hint: ['Одна лінія по ОСІ колії (дві колії = дві лінії)',
            'Через перехрестя НЕ розривати', 'Обидві рейки малює стиль (колія 1524 мм)'],
    },

    // ── Точкові ───────────────────────────────────────────────
    {
        id: 'arrow', kind: 'arrow', geometry: 'point', category: 'Точкові', twoClickBearing: true,
        label: 'Стрілка', color: '#f0f3f8',
        fields: [
            {name: 'dir', type: 'dir', options: [...DIRS], default: 'through', required: true, label: 'Напрямок'},
            BEARING,
        ],
        hint: ['Клік 1 — центр смуги за 5–10 м до стоп-лінії',
            'Клік 2 — у напрямку руху (задає азимут)', 'Тип стрілки — у панелі праворуч'],
    },
    {
        id: 'bus_mark', kind: 'bus_mark', geometry: 'point', category: 'Точкові', twoClickBearing: true,
        label: 'Літера «А»', color: '#f0f3f8', fields: [BEARING],
        hint: ['Літера «А» на асфальті поза виділеною смугою (карман зупинки)',
            'Клік 1 — позиція, клік 2 — напрямок руху'],
    },
    {
        id: 'sign', kind: 'sign', geometry: 'point', category: 'Точкові', twoClickBearing: true,
        label: 'Знак', color: '#4f8cff',
        fields: [
            {name: 'code', type: 'text', required: true, label: 'Код за ДСТУ (напр. 5.35.1)'},
            {name: 'bearing', type: 'bearing', label: 'Азимут (куди дивиться)'},
        ],
        hint: ['Точка ФАКТИЧНОЇ стійки знака (узбіччя/острівець)',
            'Клік 2 — куди дивиться лице знака (навпроти потоку)',
            'Код — з таблички: 5.35.1 перехід, 2.2 STOP…'],
    },
]

export const CATEGORIES = [...new Set(TOOLS.map(t => t.category))]

export const toolById = (id: string) => TOOLS.find(t => t.id === id)

export const fieldsForKind = (kind: string): FieldSpec[] =>
    TOOLS.find(t => t.kind === kind)?.fields ?? []

export const PALETTE = {
    bg: '#0a0c12', roadbed: '#8e99b3', curb: '#535e7a', mark: '#f0f3f8',
    yellow: '#e3c04b', island: '#aab4cb', bridge: '#99a4be', bridgeEdge: '#454f68',
    median: '#3d4f47', green: '#3a5a45', busTint: '#b8434f', tram: '#5d6884',
    accent: '#4f8cff',
}