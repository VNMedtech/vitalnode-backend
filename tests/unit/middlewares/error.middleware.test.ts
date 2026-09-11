import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { Prisma } from "../../../generated/prisma/client.js";
import {
  errorHandler,
  mapPrismaKnownRequestError,
} from "../../../src/middlewares/error.middleware.js";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../../src/shared/errors/app.errors.js";

function createErrorApp(thrower: () => void) {
  const app = express();
  app.get("/boom", (_req, _res, next) => {
    try {
      thrower();
    } catch (error) {
      next(error);
    }
  });
  app.use(errorHandler);
  return app;
}

function prismaKnownError(
  code: string,
  message = "prisma failure",
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: "test",
  });
}

describe("mapPrismaKnownRequestError", () => {
  it("maps P2002 to ConflictError", () => {
    const mapped = mapPrismaKnownRequestError(prismaKnownError("P2002"));
    expect(mapped).toBeInstanceOf(ConflictError);
    expect(mapped.statusCode).toBe(409);
    expect(mapped.code).toBe("CONFLICT");
    expect(mapped.message).not.toMatch(/Unique constraint|target|email/i);
  });

  it("maps P2025 to NotFoundError", () => {
    const mapped = mapPrismaKnownRequestError(prismaKnownError("P2025"));
    expect(mapped).toBeInstanceOf(NotFoundError);
    expect(mapped.statusCode).toBe(404);
    expect(mapped.code).toBe("NOT_FOUND");
  });

  it("maps unknown Prisma codes to 500 PRISMA_ERROR (not 400)", () => {
    const mapped = mapPrismaKnownRequestError(prismaKnownError("P9999"));
    expect(mapped.statusCode).toBe(500);
    expect(mapped.code).toBe("PRISMA_ERROR");
  });
});

describe("errorHandler", () => {
  it("includes AppError.code in the JSON body", async () => {
    const app = createErrorApp(() => {
      throw new ConflictError("Already exists");
    });

    const res = await request(app).get("/boom");

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      success: false,
      message: "Already exists",
      errors: [],
      code: "CONFLICT",
    });
  });

  it("includes ValidationError field errors and code", async () => {
    const app = createErrorApp(() => {
      throw new ValidationError("Validation failed", [
        { field: "email", message: "Required" },
      ]);
    });

    const res = await request(app).get("/boom");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: "Validation failed",
      errors: [{ field: "email", message: "Required" }],
      code: "VALIDATION_ERROR",
    });
  });

  it("maps Prisma P2002 to a conflict response instead of opaque 500", async () => {
    const app = createErrorApp(() => {
      throw prismaKnownError(
        "P2002",
        "Unique constraint failed on the fields: (`email`)",
      );
    });

    const res = await request(app).get("/boom");

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("CONFLICT");
    expect(res.body.message).toBe("A record with this value already exists");
    expect(res.body.message).not.toContain("email");
  });

  it("maps Prisma P2025 to a not-found response instead of opaque 500", async () => {
    const app = createErrorApp(() => {
      throw prismaKnownError("P2025", "Record to update not found.");
    });

    const res = await request(app).get("/boom");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      message: "Resource not found",
      errors: [],
      code: "NOT_FOUND",
    });
  });

  it("still returns opaque 500 for unhandled errors without leaking a code", async () => {
    const app = createErrorApp(() => {
      throw new Error("secret stack detail");
    });

    const res = await request(app).get("/boom");

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toEqual([]);
    expect(res.body.code).toBeUndefined();
    // In test env the raw message is allowed; production uses the opaque string.
    expect(typeof res.body.message).toBe("string");
  });
});

describe("errorHandler production opacity", () => {
  it("does not expose unhandled error message when NODE_ENV is production", async () => {
    vi.resetModules();
    vi.doMock("../../../src/config/env.js", async () => {
      const actual = await vi.importActual<
        typeof import("../../../src/config/env.js")
      >("../../../src/config/env.js");
      return {
        ...actual,
        env: {
          ...actual.env,
          nodeEnv: "production",
        },
      };
    });

    const { errorHandler: productionErrorHandler } = await import(
      "../../../src/middlewares/error.middleware.js"
    );

    const app = express();
    app.get("/boom", (_req, _res, next) => {
      next(new Error("secret db connection string"));
    });
    app.use(productionErrorHandler);

    const res = await request(app).get("/boom");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      success: false,
      message: "Internal server error",
      errors: [],
    });

    vi.doUnmock("../../../src/config/env.js");
    vi.resetModules();
  });
});
