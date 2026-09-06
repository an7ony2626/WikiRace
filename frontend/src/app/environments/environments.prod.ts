export const environment = {
  production: true,
  // Relative path: nginx.conf proxies /api/* to the backend container
  // inside the docker-compose network, so frontend and API are
  // same-origin from the browser's point of view — no CORS involved.
  apiUrl: '/api'
};