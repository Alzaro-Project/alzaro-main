// SoloOps changelog. Newest entry FIRST — the top entry's `version` drives the
// "new" dot on the sidebar button, so bump it (any unique string; we use the
// release date) whenever you add an entry. `date` is display-only, DD/MM/YYYY.
//
// Item types: 'added' | 'improved' | 'fixed' | 'removed'

export const CHANGELOG = [
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
