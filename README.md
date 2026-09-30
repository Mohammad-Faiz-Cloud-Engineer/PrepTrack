# PrepTrack

PrepTrack is an offline-first preparation tracker. All syllabus, tasks and progress stay in this browser; there is no account or backend.

## Run locally

```sh
npm install
npm run dev
npm test
npm run build
```

To deploy, publish the generated `dist/` directory to any static HTTPS host with SPA fallback to `index.html`. The service worker caches the app shell for offline use after the first successful visit. Keep the site path at the host root or configure the host's base path before building.

## Assumptions

- Goals must track at least one of Lecture, Practice or Revision; the last selected type cannot be switched off.
- A manual backlog item's overdue clock starts when it is added. A past study log is timestamped at midnight IST on the selected date because the date picker has no time field.
- A chapter task completes all topics currently in that chapter. Progress for each task is tagged with its task ID, so undo removes only records that task created; an already-done past record remains intact.
- If a chapter later gains topics, older chapter-level progress remains in History but no longer counts toward current progress.
- Deleting a syllabus item also deletes its descendants, related tasks and progress. The app confirms this first.
- Bulk paste treats any line indented by two or more spaces as a topic of the most recent chapter line. A topic line before a chapter is ignored.
- Duplicate warnings use the browser's confirmation dialog and compare open tasks with the same type in the same chapter; a whole-chapter task overlaps its topics.

## Storage and time

PrepTrack stores its versioned data in `localStorage`, asks the browser to persist that storage on first load, and keeps the theme in a separate key. Browser storage can still be cleared or evicted; regularly export a JSON backup in Settings. Import validates the backup and replaces this browser's PrepTrack data after confirmation. Import and reset do not change the theme.

All calendar dates and displayed timestamps use Asia/Kolkata (IST), based on the device clock. If the clock moves more than five minutes behind the last run, automatic task transitions pause until you choose **Resume anyway**. There is no network time source.
