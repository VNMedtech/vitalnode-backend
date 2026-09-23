import type { RequestHandler } from "express";
import { UnauthorizedError } from "../../../shared/errors/app.errors.js";
import { successResponse } from "../../../shared/responses/api.response.js";
import { CompanyContentService } from "../services/companyContent.service.js";
import type {
  CreateMemberBody,
  ListMembersQuery,
  MemberIdParam,
  UpdateMemberBody,
  UpdateWhyBody,
} from "../validators/companyContent.schemas.js";

const service = new CompanyContentService();

function requireUserId(req: Parameters<RequestHandler>[0]): string {
  if (!req.user?.id) throw new UnauthorizedError("Authentication required");
  return req.user.id;
}

export const getPublicWhy: RequestHandler = async (_req, res, next) => {
  try {
    const data = await service.getWhySection(false);
    res.status(200).json(successResponse(data, "Why Vitalnode fetched"));
  } catch (err) {
    next(err);
  }
};

export const getAdminWhy: RequestHandler = async (_req, res, next) => {
  try {
    const data = await service.getWhySection(true);
    res.status(200).json(successResponse(data, "Why Vitalnode fetched"));
  } catch (err) {
    next(err);
  }
};

export const updateWhy: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireUserId(req);
    const body = req.body as UpdateWhyBody;
    const data = await service.updateWhySection(actorUserId, body);
    res.status(200).json(successResponse(data, "Why Vitalnode updated"));
  } catch (err) {
    next(err);
  }
};

export const listPublicMembers: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as ListMembersQuery;
    const data = await service.listMembers({
      type: query.type,
      publicOnly: true,
    });
    res.status(200).json(successResponse(data, "Members fetched"));
  } catch (err) {
    next(err);
  }
};

export const listAdminMembers: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as ListMembersQuery;
    const data = await service.listMembers({
      type: query.type,
      publicOnly: false,
    });
    res.status(200).json(successResponse(data, "Members fetched"));
  } catch (err) {
    next(err);
  }
};

export const createMember: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireUserId(req);
    const body = req.body as CreateMemberBody;
    const data = await service.createMember(actorUserId, body);
    res.status(201).json(successResponse(data, "Member created"));
  } catch (err) {
    next(err);
  }
};

export const updateMember: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireUserId(req);
    const { id } = req.params as MemberIdParam;
    const body = req.body as UpdateMemberBody;
    const data = await service.updateMember(actorUserId, id, body);
    res.status(200).json(successResponse(data, "Member updated"));
  } catch (err) {
    next(err);
  }
};

export const deleteMember: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireUserId(req);
    const { id } = req.params as MemberIdParam;
    const data = await service.deleteMember(actorUserId, id);
    res.status(200).json(successResponse(data, "Member deleted"));
  } catch (err) {
    next(err);
  }
};
