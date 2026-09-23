import { z } from "zod";
import { ADMIN_MODULE_VALUES } from "../../../shared/enums/adminModule.enum.js";
import { strongPasswordSchema } from "../../../shared/validators/password.schema.js";

const uniqueModulesSchema = z
  .array(z.enum(ADMIN_MODULE_VALUES))
  .min(1, "Assign at least one module")
  .max(ADMIN_MODULE_VALUES.length)
  .superRefine((modules, ctx) => {
    if (new Set(modules).size !== modules.length) {
      ctx.addIssue({
        code: "custom",
        message: "Duplicate modules are not allowed",
      });
    }
  });

export const createSubAdminBodySchema = z
  .object({
    email: z.string().email().trim().toLowerCase(),
    firstName: z.string().min(1).max(80).trim(),
    lastName: z.string().min(1).max(80).trim(),
    phoneNumber: z.string().min(8).max(20).trim().optional(),
    password: strongPasswordSchema,
    modules: uniqueModulesSchema,
  })
  .strict();

export type CreateSubAdminBody = z.infer<typeof createSubAdminBodySchema>;
