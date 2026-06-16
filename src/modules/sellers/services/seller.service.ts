import { prisma } from "../../../infrastructure/prisma/client.js";
import { NotFoundError } from "../../../shared/errors/app.errors.js";
import { buildPaginationMeta } from "../../../shared/responses/api.response.js";
import {
  toSellerDetailDto,
  toSellerListItemDtoFromRecord,
} from "../dto/seller.dto.js";
import { SellerRepository } from "../repositories/seller.repository.js";
import type {
  ListSellersQuery,
  SellerDetailDto,
  SellerListItemDto,
} from "../types/seller.types.js";

export class SellerService {
  private readonly repo = new SellerRepository(prisma);

  async listSellers(query: ListSellersQuery): Promise<{
    items: SellerListItemDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const [records, total] = await Promise.all([
      this.repo.findManyPaginated(query),
      this.repo.count({
        search: query.search,
        companyName: query.companyName,
        email: query.email,
        approvalStatus: query.approvalStatus,
        city: query.city,
        state: query.state,
        country: query.country,
      }),
    ]);

    return {
      items: records.map(toSellerListItemDtoFromRecord),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async getSellerById(id: string): Promise<SellerDetailDto> {
    const seller = await this.repo.findById(id);
    if (!seller) {
      throw new NotFoundError("Seller not found");
    }

    return toSellerDetailDto(seller);
  }
}
