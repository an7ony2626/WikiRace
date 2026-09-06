# Frontend

Angular SPA for Road-To-Unina, generated with Angular CLI 22.1.3.

**Stack:**
- Angular 22 (standalone components, signals, `OnPush` change detection)
- SCSS
- Vitest (unit tests)

## Prerequisites

- Node.js (see `package.json` → `packageManager` for the expected npm version)
- The backend running and reachable (default: `http://localhost:8080`)

> If you just want to run everything (including the backend and database) without installing anything locally, use Docker instead — see the root [README.md](../README.md).

## Development server

```bash
npm install
npm start
```

This runs `ng serve --proxy-config proxy.conf.json`, which forwards any request to `/api/*` to `http://localhost:8080` (see `proxy.conf.json`) — so the backend must already be running locally on port 8080.

Once the server is running, open your browser at `http://localhost:4200/`. The app reloads automatically on source changes.

## Building

```bash
npm run build
```

Build artifacts are output to `dist/frontend/browser/`, optimized for production by default.

For a development build (unoptimized, with source maps):

```bash
npm run watch
```

## Running unit tests

```bash
npm test
```

Runs unit tests with [Vitest](https://vitest.dev/).

## Running end-to-end tests

End-to-end tests are not yet part of this repository.

## Code scaffolding

To generate a new component:

```bash
ng generate component component-name
```

For the full list of available schematics:

```bash
ng generate --help
```

## Additional resources

- [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli)