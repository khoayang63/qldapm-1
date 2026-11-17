# Todo App

A small, dependency-free todo app that runs entirely in the browser and stores tasks in `localStorage`.

## Features

- Add, edit (edit button, double-click or <kbd>Enter</kbd> on a task), complete and delete tasks
- Filters: All / Active / Completed, plus filtering by tag
- Live counters and "Clear completed"
- **Due dates**: optional due date on add and edit; each task shows a friendly date ("Today", "Tomorrow", "Mon, Nov 17")
- **Overdue alerts**: tasks past the end of their due day (local time) are highlighted, and a banner counts overdue tasks. The state refreshes after reload, when the tab regains focus, and automatically at midnight
- **Tags**: built-in Work / Personal / Urgent tags plus custom tags, each with a high-contrast color that stays legible in dark and light themes; assign several tags per task and filter by tag
- **JSON export / import**: export all tasks (with a version field and your custom tags) to a file; import with merge or replace, with schema validation and clear errors that leave existing data untouched
- Dark and light theme, remembered between visits
- Offline-first: no server, no build step, no dependencies, no tracking
- Responsive layout and keyboard accessible

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
# or
python -m http.server 8000
```

## Deploy

The app is fully static. Enable GitHub Pages for this repository
(Settings → Pages → Deploy from branch → `main` / root) and it will be live at
`https://khoayang63.github.io/qldapm-1/`.

## Project structure

| File | Purpose |
| --- | --- |
| `index.html` | Markup and the task item template |
| `styles.css` | Theme variables, layout and component styles |
| `app.js` | State, rendering, persistence, tags, due dates and import/export |
| `README.md` | Documentation |

## Data

Tasks are stored under the `ptit.todo.v1` key in `localStorage`, custom tags under
`ptit.todo.tags.v1`, and the theme under `ptit.todo.theme`. Existing tasks saved by
earlier versions load unchanged; missing `due` and `tags` fields default to "no due date"
and "no tags".

Clearing site data resets the app.

### Export format

```json
{
  "version": 2,
  "app": "ptit.todo",
  "exportedAt": "2026-11-17T10:00:00.000Z",
  "tasks": [
    {
      "id": "…",
      "title": "Write release notes",
      "completed": false,
      "due": "2026-11-20",
      "tags": ["Work", "Urgent"]
    }
  ],
  "tags": [{ "name": "Errands", "color": "#7c3aed" }]
}
```

Import accepts this object shape or a plain array of tasks. Every task must have a
non-empty `title`; `due` must be `YYYY-MM-DD` or null; `tags` must be an array of names.
Invalid files are rejected as a whole, so existing tasks are never partially overwritten.

- **Merge** keeps current tasks and updates any whose `id` matches, adding the rest.
- **Replace** swaps the task list for the imported one. Custom tags are merged, not deleted.
