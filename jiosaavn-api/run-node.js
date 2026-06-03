import { serve } from '@hono/node-server';
import app from './src/server.ts';

const port = 3000;
console.log(`Starting JioSaavn API locally on port ${port}...`);

serve({
  fetch: app.fetch,
  port: port
}, (info) => {
  console.log(`JioSaavn API is running successfully at http://localhost:${info.port}`);
  console.log(`Press Ctrl+C to stop the API server.`);
});
