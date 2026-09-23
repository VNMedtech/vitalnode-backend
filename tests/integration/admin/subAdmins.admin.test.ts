import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { UserRole } from "../../../src/shared/enums/userRole.enum.js";
import { UserStatus } from "../../../src/shared/enums/userStatus.enum.js";
import {
  createAdminViaApi,
  createSubAdminViaPrisma,
  loginViaApi,
  registerBuyerViaApi,
} from "../../factories/user.factory.js";
import {
  categoryRequest,
  subAdminRequest,
  userRequest,
} from "../../utils/request.helpers.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";
import { getTestApp } from "../../utils/testApp.js";

describe("Admin Sub-admins — Management", () => {
  let app: Express;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it("lets a super admin onboard a sub-admin with at least one module", async () => {
    const prisma = getTestPrisma();
    const { login } = await createAdminViaApi(app, prisma);

    const res = await subAdminRequest(app, login.auth.accessToken).create({
      email: "ops-lead@example.com",
      firstName: "Ops",
      lastName: "Lead",
      password: "SubAdmin1!",
      modules: ["CATEGORIES", "ORDERS"],
    });

    expect(res.status).toBe(201);
    expect(res.body.data.temporaryPassword).toBeUndefined();
    expect(res.body.data).toMatchObject({
      email: "ops-lead@example.com",
      firstName: "Ops",
      lastName: "Lead",
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
    });
    expect(res.body.data.subAdmin.modules.sort()).toEqual(["CATEGORIES", "ORDERS"]);

    const stored = await prisma.user.findUnique({
      where: { email: "ops-lead@example.com" },
    });
    expect(stored?.role).toBe(UserRole.SUB_ADMIN);
  });

  it("rejects onboarding with zero modules", async () => {
    const prisma = getTestPrisma();
    const { login } = await createAdminViaApi(app, prisma);

    const res = await subAdminRequest(app, login.auth.accessToken).create({
      email: "empty-modules@example.com",
      firstName: "Empty",
      lastName: "Modules",
      password: "SubAdmin1!",
      modules: [],
    });

    expect(res.status).toBe(400);
  });

  it("gives a sub-admin full access only to assigned modules", async () => {
    const prisma = getTestPrisma();
    const created = await createSubAdminViaPrisma(prisma, {
      modules: ["CATEGORIES"],
    });
    const login = await loginViaApi(app, created.email, created.password);

    const categoriesRes = await categoryRequest(
      app,
      login.auth.accessToken,
    ).create({
      name: `Surgical-${Date.now()}`,
    });
    expect(categoriesRes.status).toBe(201);

    const modulesRes = await subAdminRequest(
      app,
      login.auth.accessToken,
    ).list();
    expect(modulesRes.status).toBe(403);

    const profileRes = await userRequest(app, login.auth.accessToken).getProfile();
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.data.role).toBe(UserRole.SUB_ADMIN);
    expect(profileRes.body.data.adminModules).toEqual(["CATEGORIES"]);
  });

  it("does not let a sub-admin manage other sub-admins", async () => {
    const prisma = getTestPrisma();
    const created = await createSubAdminViaPrisma(prisma, {
      modules: ["USERS", "CATEGORIES"],
    });
    const login = await loginViaApi(app, created.email, created.password);

    const createRes = await subAdminRequest(app, login.auth.accessToken).create({
      email: "escalation@example.com",
      firstName: "Nope",
      lastName: "Nope",
      password: "SubAdmin1!",
      modules: ["REPORTS"],
    });

    expect(createRes.status).toBe(403);
  });

  it("lets a super admin update assigned modules", async () => {
    const prisma = getTestPrisma();
    const { login } = await createAdminViaApi(app, prisma);
    const created = await createSubAdminViaPrisma(prisma, {
      modules: ["CATEGORIES"],
    });

    const res = await subAdminRequest(app, login.auth.accessToken).update(
      created.user.id,
      { modules: ["ORDERS", "AUDIT"] },
    );

    expect(res.status).toBe(200);
    expect(res.body.data.modules.sort()).toEqual(["AUDIT", "ORDERS"]);
  });

  it("rejects buyers from sub-admin APIs", async () => {
    const buyer = await registerBuyerViaApi(app);
    const res = await subAdminRequest(app, buyer.auth.accessToken).list();
    expect(res.status).toBe(403);
  });
});
