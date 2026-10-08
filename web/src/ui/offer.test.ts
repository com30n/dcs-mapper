import { describe, expect, it } from 'vitest'
import { offer, takeOffered } from './offer'

const click = () => ({ nativeEvent: new Event('contextmenu') })
const item = (label: string) => ({ label, run: () => undefined })

describe('right-click menu offers', () => {
  it('stacks what the things under the pointer offer, nearest first', () => {
    const e = click()
    offer(() => [item('mark')])(e)
    offer(() => [item('cell')])(e)
    expect(takeOffered(e).map((i) => (i === 'line' ? i : i.label))).toEqual(['mark', 'line', 'cell'])
  })

  it('forgets an offer that no menu picked up', () => {
    offer(() => [item('stale')])(click())
    expect(takeOffered(click())).toEqual([])
  })
})
