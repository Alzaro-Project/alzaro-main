// SoloOps changelog. Newest entry FIRST — the top entry's `version` drives the
// "new" dot on the sidebar button, so bump it (any unique string; we use the
// release date) whenever you add an entry. `date` is display-only, DD/MM/YYYY.
//
// Item types: 'added' | 'improved' | 'fixed' | 'removed'

export const CHANGELOG = [
  {
    version: '2026-08-13-5',
    date: '13/08/2026',
    title: 'Items',
    items: [
      { type: 'added', text: 'New Items tab — save the things you invoice for and the costs you log regularly, then pick them straight into the Add income and Add expense forms instead of retyping.' },
      { type: 'fixed', text: 'Suppliers (auto-added from your expenses) no longer appear in the client dropdown when adding income — that list is customers only now.' },
    ],
  },
  {
    version: '2026-08-13-4',
    date: '13/08/2026',
    title: 'Layout fix',
    items: [
      { type: 'fixed', text: 'The sidebar now stays pinned at full height while you scroll, instead of scrolling away with the page.' },
    ],
  },
  {
    version: '2026-08-13-3',
    date: '13/08/2026',
    title: 'Dashboard tidy-up',
    items: [
      { type: 'added', text: 'Custom date range on the dashboard timeline — pick any From/To dates alongside Today, This Month and the rest.' },
      { type: 'improved', text: "What's new moved to the top right of the page, and the redundant year dropdown is gone from the dashboard (the timeline is the filter there)." },
    ],
  },
  {
    version: '2026-08-13-2',
    date: '13/08/2026',
    title: 'View your receipts',
    items: [
      { type: 'added', text: 'You can now view attached receipt files — a new "Attached receipts" list in the Receipts tab, and clicking the green receipt tag on any expense opens it too.' },
    ],
  },
  {
    version: '2026-08-13',
    date: '13/08/2026',
    title: 'Menu cleanup',
    items: [
      { type: 'added', text: "What's new — this changelog, so you can see what's changed between releases." },
      { type: 'removed', text: 'Recurring section removed from the menu. Your expense data is unaffected — everything is still in Expenses.' },
    ],
  },
]

export const LATEST_VERSION = CHANGELOG[0]?.version || ''
