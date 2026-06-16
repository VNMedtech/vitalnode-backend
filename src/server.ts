/**
 * HTTP server bootstrap — binds port and starts Express app.
 */
import { app } from "./app.js";

const PORT = process.env.PORT ?? 3000;

export function startServer(): void {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on port ${PORT}`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
