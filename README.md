# Todo App

A small, dependency-free todo app that runs entirely in the browser and stores tasks in `localStorage`.

## Features

- Add, edit (double-click or <kbd>Enter</kbd> on a task), complete and delete tasks
- Filters: All / Active / Completed
- Live counters and "Clear completed"
- Dark and light theme, remembered between visits
- Offline-first: no server, no build step, no tracking
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
| `app.js` | State, rendering, persistence and interactions |

## Data

Tasks are stored under the `ptit.todo.v1` key in `localStorage`; the theme is stored under
`ptit.todo.theme`. Clearing site data resets the app.
