import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { disconnectTestPrisma } from "../../utils/db.js";
import { getTestApp } from "../../utils/testApp.js";

describe("Health endpoints", () => {
  let app: Express;

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it("GET /health returns 200 with ok status", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("GET /ready returns 200 when database is reachable", async () => {
    const res = await request(app).get("/ready");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ready" });
  });
});
