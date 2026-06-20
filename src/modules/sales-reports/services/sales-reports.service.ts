import { prisma } from "../../../infrastructure/prisma/client.js";
import { ForbiddenError } from "../../../shared/errors/app.errors.js";
import { buildPaginationMeta } from "../../../shared/responses/api.response.js";
import { SellerRepository } from "../../sellers/repositories/seller.repository.js";
import {
  toPlatformSalesReportDto,
  toSellerOrdersSummaryDto,
  toSellerRevenueSummaryDto,
  toSellerSalesReportItemDto,
  toSellerSalesSummaryDto,
} from "../dto/sales-reports.dto.js";
import { SalesReportsRepository } from "../repositories/sales-reports.repository.js";
import type {
  PlatformSalesReportDto,
  SellerOrdersSummaryDto,
  SellerRevenueSummaryDto,
  SellerSalesReportItemDto,
  SellerSalesSummaryDto,
} from "../types/sales-reports.types.js";
import {
  resolveSalesReportPeriod,
  type PlatformSalesReportQueryInput,
  type SellerOrdersSummaryQueryInput,
  type SellerRevenueSummaryQueryInput,
  type SellerSalesReportQueryInput,
  type SellerSalesSummaryQueryInput,
} from "../validators/query.schema.js";

export class SalesReportsService {
  private readonly salesReportsRepo = new SalesReportsRepository(prisma);
  private readonly sellerRepo = new SellerRepository(prisma);

  private async resolveSellerId(actorUserId: string): Promise<string> {
    const seller = await this.sellerRepo.findIdByUserId(actorUserId);
    if (!seller) {
      throw new ForbiddenError("Seller profile required");
    }
    return seller.id;
  }

  async getSellerSalesSummary(
    actorUserId: string,
    query: SellerSalesSummaryQueryInput,
  ): Promise<SellerSalesSummaryDto> {
    const sellerId = await this.resolveSellerId(actorUserId);
    const { from, to } = resolveSalesReportPeriod(query);

    const [orderMetrics, revenueMetrics, topProducts] = await Promise.all([
      this.salesReportsRepo.getSellerOrderMetrics(sellerId, from, to),
      this.salesReportsRepo.getSellerRevenueMetrics(sellerId, from, to),
      this.salesReportsRepo.getSellerTopProducts(
        sellerId,
        from,
        to,
        query.topProductsLimit,
      ),
    ]);

    return toSellerSalesSummaryDto(
      orderMetrics,
      revenueMetrics,
      topProducts,
      from,
      to,
    );
  }

  async getSellerOrdersSummary(
    actorUserId: string,
    query: SellerOrdersSummaryQueryInput,
  ): Promise<SellerOrdersSummaryDto> {
    const sellerId = await this.resolveSellerId(actorUserId);
    const { from, to } = resolveSalesReportPeriod(query);
    const orderMetrics = await this.salesReportsRepo.getSellerOrderMetrics(
      sellerId,
      from,
      to,
    );
    return toSellerOrdersSummaryDto(orderMetrics, from, to);
  }

  async getSellerRevenueSummary(
    actorUserId: string,
    query: SellerRevenueSummaryQueryInput,
  ): Promise<SellerRevenueSummaryDto> {
    const sellerId = await this.resolveSellerId(actorUserId);
    const { from, to } = resolveSalesReportPeriod(query);

    const [revenueMetrics, buckets] = await Promise.all([
      this.salesReportsRepo.getSellerRevenueMetrics(sellerId, from, to),
      this.salesReportsRepo.getSellerRevenueBuckets(
        sellerId,
        query.groupBy,
        from,
        to,
      ),
    ]);

    return toSellerRevenueSummaryDto(revenueMetrics, buckets, from, to);
  }

  async getPlatformSalesReport(
    query: PlatformSalesReportQueryInput,
  ): Promise<PlatformSalesReportDto> {
    const { from, to } = resolveSalesReportPeriod(query);
    const record = await this.salesReportsRepo.getPlatformSalesMetrics(from, to);
    return toPlatformSalesReportDto(record, from, to);
  }

  async listSellerSalesReport(
    query: SellerSalesReportQueryInput,
  ): Promise<{
    items: SellerSalesReportItemDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const { from, to } = resolveSalesReportPeriod(query);

    const [rows, total] = await Promise.all([
      this.salesReportsRepo.findSellerSalesReportRows({
        from,
        to,
        page: query.page,
        limit: query.limit,
      }),
      this.salesReportsRepo.countSellerSalesReportRows(),
    ]);

    return {
      items: rows.map(toSellerSalesReportItemDto),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }
}
