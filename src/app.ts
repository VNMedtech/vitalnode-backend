/**
 * Express application factory — middleware, routes, and error handling.
 */
import express, { type RequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { corsOptions, swaggerOptions } from "./config/index.js";
import { registerNotificationHandlers } from "./modules/notifications/handlers/registerNotificationHandlers.js";
import { apiRouter } from "./routes/index.js";
import { errorHandler, rateLimiter, requestLogger } from "./middlewares/index.js";

registerNotificationHandlers();

export const app = express();

app.disable("x-powered-by");

app.use(helmet());
app.use(cors(corsOptions));

const captureRawBody: RequestHandler = (req, _res, next) => {
  req.rawBody = req.body;
  next();
};

const jsonParser = express.json({ limit: "1mb" });

app.use(
  "/api/v1/payments/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  captureRawBody,
);

app.use((req, res, next) => {
  if (req.path === "/api/v1/payments/webhook") {
    next();
    return;
  }
  jsonParser(req, res, next);
});
app.use(express.urlencoded({ extended: true }));

app.use(requestLogger);
app.use(rateLimiter);

const openapiSpec = swaggerJSDoc({
  definition: swaggerOptions,
  apis: ["./src/modules/**/routes/*.ts", "./src/routes/*.ts"],
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

app.use("/api/v1", apiRouter);

app.use(errorHandler);