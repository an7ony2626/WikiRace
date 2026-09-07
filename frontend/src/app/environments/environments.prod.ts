export const environment = {
  production: true,
  // Absolute URL: the live frontend is a static Cloudflare Pages site,
  // an entirely different origin from the Render backend, so a relative
  // path (correct only for the docker-compose nginx proxy setup) would
  // resolve against the frontend's own domain and 404.
  apiUrl: 'https://wikirace-mih0.onrender.com/api'
};