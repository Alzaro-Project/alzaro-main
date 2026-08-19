// ServiceOps version — single source of truth for the sidebar badge and the
// "What's new" changelog.
//
// TO SHIP AN UPDATE:
//   1. Bump VERSION (MAJOR.MINOR.PATCH):
//        PATCH 1.0.0→1.0.1  a fix, nothing new
//        MINOR 1.0.0→1.1.0  a new feature, nothing breaks
//        MAJOR 1.0.0→2.0.0  a big release / redesign / breaking change
//   2. Add ONE entry to the TOP of CHANGELOG (newest first).
//   3. Merge, then tag:  serviceops-v<VERSION>   e.g. serviceops-v1.1.0
//      (per-vertical tag — this app's versions move on their own. It's also
//       your rollback point; see ROLLBACK.md at the repo root.)
// This file is ServiceOps-only. Bumping it never touches other verticals.

export const VERSION = '1.0.0'

export const CHANGELOG = [
  {
    version: '1.0.0',
    date: '2026-08-19',
    type: 'major',
    title: 'Baseline',
    changes: [
      'First tracked version — everything shipped so far becomes the 1.0.0 baseline.',
    ],
  },
]
