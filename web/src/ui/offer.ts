export type MenuItem =
  | { label: string; run: () => void; tone?: 'warn'; disabled?: boolean }
  | { label: string; on: boolean; turn: (on: boolean) => void }
  | 'line'

type Click = { nativeEvent: Event }

let offered: { click: Event; items: MenuItem[] } | null = null

export const offer = (items: () => MenuItem[]) => ({ nativeEvent }: Click) => {
  const list = items()
  offered = offered?.click === nativeEvent ? { click: nativeEvent, items: [...offered.items, 'line', ...list] } : { click: nativeEvent, items: list }
}

export function takeOffered({ nativeEvent }: Click) {
  const list = offered?.click === nativeEvent ? offered.items : []
  offered = null
  return list
}
