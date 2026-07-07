export const DIR_PATHS: Record<string, string> = {
    through: 'M12 20V7M12 4l-4 5h8z',
    left: 'M12 20v-8c0-2 -1-3 -3-3H7M8 12L4 9l4-3',
    right: 'M12 20v-8c0-2 1-3 3-3h2M16 12l4-3-4-3',
    through_left: 'M12 20V7M12 4l-3 4h6zM11 13c-2 0-3-1-4-1H6M7.5 14.5L4 12l3.5-2.5',
    through_right: 'M12 20V7M12 4l-3 4h6zM13 13c2 0 3-1 4-1h1M16.5 14.5L20 12l-3.5-2.5',
}
export const DirIcon = ({dir}: {dir: string}) => (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none"
stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
<path d={DIR_PATHS[dir]}/>
</svg>
)

export const EyeIcon = ({off}: {off: boolean}) => (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none"
stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
{off
    ? <><path d="M3 3l18 18M10.5 5.2A9.8 9.8 0 0 1 12 5c5 0 9 4.5 10 7-.4 1-1.3 2.4-2.6 3.7M6.6 6.6C4.1 8.1 2.5 10.4 2 12c1 2.5 5 7 10 7 1.5 0 2.9-.4 4.2-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></>
    : <><path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z"/><circle cx="12" cy="12" r="3"/></>}
    </svg>
)