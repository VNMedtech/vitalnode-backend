/**
 * API route aggregator — mounts all module routers under /api/v1.
 */
import { Router } from "express";
import { authRouter } from "../modules/auth/routes/auth.routes.js";
import { userRouter } from "../modules/users/routes/user.routes.js";
import { addressRouter } from "../modules/addresses/routes/address.routes.js";
import { buyerRouter } from "../modules/buyers/routes/buyer.routes.js";
import { sellerRouter } from "../modules/sellers/routes/seller.routes.js";
import { deliveryPartnerRouter } from "../modules/deliveryPartners/routes/deliveryPartner.routes.js";
import { categoryRouter } from "../modules/categories/routes/category.routes.js";
import { productRouter } from "../modules/products/routes/product.routes.js";
import { inventoryRouter } from "../modules/inventory/routes/inventory.routes.js";
import { cartRouter } from "../modules/cart/routes/cart.routes.js";
import { orderRouter } from "../modules/orders/routes/order.routes.js";
import { paymentRouter } from "../modules/payments/routes/payment.routes.js";
import { uploadRouter } from "../modules/uploads/routes/upload.routes.js";
import { notificationRouter } from "../modules/notifications/routes/notification.routes.js";
import { analyticsRouter } from "../modules/analytics/routes/analytics.routes.js";
import { auditRouter } from "../modules/audit/routes/audit.routes.js";
import { adminRouter } from "../modules/admin/routes/admin.routes.js";
import { reviewRouter } from "../modules/reviews/routes/review.routes.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/buyers", buyerRouter);
apiRouter.use("/addresses", addressRouter);
apiRouter.use("/sellers", sellerRouter);
apiRouter.use("/delivery-partners", deliveryPartnerRouter);
apiRouter.use("/categories", categoryRouter);
apiRouter.use("/products", productRouter);
apiRouter.use("/inventory", inventoryRouter);
apiRouter.use("/cart", cartRouter);
apiRouter.use("/orders", orderRouter);
apiRouter.use("/payments", paymentRouter);
apiRouter.use("/uploads", uploadRouter);
apiRouter.use("/notifications", notificationRouter);
apiRouter.use("/analytics", analyticsRouter);
apiRouter.use("/audit-logs", auditRouter);
apiRouter.use("/reviews", reviewRouter);
apiRouter.use("/admin", adminRouter);