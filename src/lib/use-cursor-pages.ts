import { useRef, useState } from 'react'

export function useCursorPages<T>() {
  const start = useRef<HTMLDivElement>(null)
  const [cursors, setCursors] = useState<Array<T | null>>([null])
  const scrollToStart = () => start.current?.scrollIntoView({ block: 'start' })
  return {
    start,
    cursor: cursors[cursors.length - 1],
    page: cursors.length,
    hasPrevious: cursors.length > 1,
    reset: () => setCursors([null]),
    previous: () => {
      setCursors((pages) => (pages.length > 1 ? pages.slice(0, -1) : pages))
      scrollToStart()
    },
    next: (cursor: T | null | undefined) => {
      if (cursor === null || cursor === undefined) return
      setCursors((pages) => [...pages, cursor])
      scrollToStart()
    },
  }
}
