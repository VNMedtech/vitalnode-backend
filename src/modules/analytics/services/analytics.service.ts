import { prisma } from "../../../infrastructure/prisma/client.js";
import { buildPaginationMeta } from "../../../shared/responses/api.response.js";
import { toLowStockAlertDto } from "../../inventory/dto/inventory.dto.js";
import type { LowStockAlertDto } from "../../inventory/types/inventory.types.js";
import {
  toDashboardSummaryDto,
  toOrderStatisticsDto,
  toProductStatisticsDto,
  toRevenueStatisticsDto,
  toSellerStatisticsDto,
  toUserStatisticsDto,
  toCommissionStatisticsDto,
} from "../dto/analytics.dto.js";
import { AnalyticsRepository } from "../repositories/analytics.repository.js";
import type {
  DashboardSummaryDto,
  OrderStatisticsDto,
  ProductStatisticsDto,
  RevenueStatisticsDto,
  SellerStatisticsDto,
  UserStatisticsDto,
  CommissionStatisticsDto,
} from "../types/analytics.types.js";
import type {
  InventoryAlertsQueryInput,
  CommissionStatisticsQueryInput,
  RevenueStatisticsQueryInput,
} from "../validators/query.schema.js";

export class AnalyticsService {
  private readonly analyticsRepo = new AnalyticsRepository(prisma);

  async getDashboardSummary(): Promise<DashboardSummaryDto> {
    const record = await this.analyticsRepo.getDashboardSummary();
    return toDashboardSummaryDto(record);
  }

  async getUserStatistics(
    from?: Date,
    to?: Date,
  ): Promise<UserStatisticsDto> {
    const record = await this.analyticsRepo.getUserStatistics(from, to);
    return toUserStatisticsDto(record, from, to);
  }

  async getSellerStatistics(
    from?: Date,
    to?: Date,
  ): Promise<SellerStatisticsDto> {
    const record = await this.analyticsRepo.getSellerStatistics(from, to);
    return toSellerStatisticsDto(record, from, to);
  }

  async getProductStatistics(
    from?: Date,
    to?: Date,
  ): Promise<ProductStatisticsDto> {
    const record = await this.analyticsRepo.getProductStatistics(from, to);
    return toProductStatisticsDto(record, from, to);
  }

  async getOrderStatistics(
    from?: Date,
    to?: Date,
  ): Promise<OrderStatisticsDto> {
    const record = await this.analyticsRepo.getOrderStatistics(from, to);
    return toOrderStatisticsDto(record, from, to);
  }

  async getRevenueStatistics(
    query: RevenueStatisticsQueryInput,
  ): Promise<RevenueStatisticsDto> {
    const { from, to, groupBy } = query;
    const [record, buckets] = await Promise.all([
      this.analyticsRepo.getRevenueStatistics(from, to),
      this.analyticsRepo.getRevenueBuckets(groupBy, from, to),
    ]);
    return toRevenueStatisticsDto(record, buckets, from, to);
  }

  async listInventoryAlerts(
    query: InventoryAlertsQueryInput,
  ): Promise<{
    items: LowStockAlertDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const [alerts, total] = await Promise.all([
      this.analyticsRepo.findLowStockAlerts({
        alertStatus: query.alertStatus,
        page: query.page,
        limit: query.limit,
      }),
      this.analyticsRepo.countLowStockAlerts({
        alertStatus: query.alertStatus,
      }),
    ]);

    return {
      items: alerts.map(toLowStockAlertDto),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async getCommissionStatistics(
    query: CommissionStatisticsQueryInput,
  ): Promise<CommissionStatisticsDto> {
    const { from, to } = query;
    const record = await this.analyticsRepo.getCommissionStatistics(from, to);
    return toCommissionStatisticsDto(record, from, to);
  }
}
