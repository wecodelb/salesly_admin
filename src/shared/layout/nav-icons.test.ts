import { describe, expect, it } from 'vitest'

import { ICON_MAP } from './nav-icons'
import { NAV_GROUPS } from './nav-config'

/**
 * Every menu item has an icon.
 *
 * The sidebar renders `{Icon && <Icon />}`, so an item naming an icon the map
 * has not got renders no icon at all — no error, no warning, just a label
 * sitting out of line with every other row in the menu. Load Requests shipped
 * like that and nobody could see why it looked wrong, only that it did.
 */
const ITEMS = NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => [item.key, item.icon] as const),
)

describe('the sidebar icons', () => {
  it.each(ITEMS)('%s names an icon the map actually has', (_key, icon) => {
    // Defined, not "is a function": lucide ships forwardRef objects.
    expect(ICON_MAP[icon], `no icon registered as "${icon}"`).toBeDefined()
  })

  it('registers no icon nothing uses', () => {
    // A stale import is only clutter, but it is the same drift in the other
    // direction and it is free to catch.
    const used = new Set(ITEMS.map(([, icon]) => icon))
    const unused = Object.keys(ICON_MAP).filter((name) => !used.has(name))

    expect(unused, `registered but unused: ${unused.join(', ')}`).toEqual([])
  })
})
