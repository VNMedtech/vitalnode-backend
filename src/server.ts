/**
 * HTTP server bootstrap — binds port and starts Express app.
 */
import { createServer, type Server } from "node:http";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { runStartupChecks } from "./config/startupChecks.js";
import { disconnectPrisma } from "./infrastructure/prisma/client.js";
import { logger } from "./infrastructure/logger/logger.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

let server: Server | undefined;
let isShuttingDown = false;

function registerShutdownHandlers(): void {
  const shutdown = (signal: string) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    logger.info({ signal }, "Shutdown signal received");

    const forceExitTimer = setTimeout(() => {
      logger.error("Graceful shutdown timed out; forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    forceExitTimer.unref();

    if (!server) {
      void disconnectPrisma().finally(() => {
        clearTimeout(forceExitTimer);
        process.exit(0);
      });
      return;
    }

    server.close((closeError) => {
      if (closeError) {
        logger.error({ err: closeError }, "Error closing HTTP server");
      }

      void disconnectPrisma()
        .catch((disconnectError) => {
          logger.error({ err: disconnectError }, "Error disconnecting Prisma");
        })
        .finally(() => {
          clearTimeout(forceExitTimer);
          logger.info("Shutdown complete");
          process.exit(closeError ? 1 : 0);
        });
    });
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

export function startServer(): Server {
  runStartupChecks(env);

  server = createServer(app);
  server.listen(env.port, () => {
    logger.info({ port: env.port }, "Server listening");
  });
  registerShutdownHandlers();
  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
