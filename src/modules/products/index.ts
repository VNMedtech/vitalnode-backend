/** Barrel exports for the products module. */

export * from "./controllers/product.controller.js";
export * from "./services/product.service.js";
export * from "./services/productApproval.service.js";
export * from "./repositories/product.repository.js";
export * from "./repositories/productMedia.repository.js";
export * from "./repositories/productDocument.repository.js";
export * from "./validators/createProduct.schema.js";
export * from "./validators/updateProduct.schema.js";
export * from "./validators/approveProduct.schema.js";
export * from "./validators/rejectProduct.schema.js";
export * from "./validators/productParams.schema.js";
export * from "./validators/query.schema.js";
export * from "./validators/compareProducts.schema.js";
export * from "./dto/product.dto.js";
export * from "./routes/product.routes.js";
export * from "./types/product.types.js";
export * from "./constants/product.constants.js";
