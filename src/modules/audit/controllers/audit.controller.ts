import type { RequestHandler } from "express";
import { paginatedResponse, successResponse } from "../../../shared/responses/api.response.js";
import { AuditService } from "../services/audit.service.js";
import type { AuditLogParamsInput } from "../validators/params.schema.js";
import type { ListAuditLogsQueryInput } from "../validators/query.schema.js";

const auditService = new AuditService();

export const listAuditLogs: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as ListAuditLogsQueryInput;
    const result = await auditService.listAuditLogs(query);
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Audit logs fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const getAuditLogDetails: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as unknown as AuditLogParamsInput;
    const data = await auditService.getAuditLogDetails(id);
    res
      .status(200)
      .json(successResponse(data, "Audit log fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const auditController = {
  listAuditLogs,
  getAuditLogDetails,
};

