import { z } from "zod";
import { ADMIN_MODULE_VALUES } from "../../../shared/enums/adminModule.enum.js";

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

export const updateSubAdminBodySchema = z
  .object({
    firstName: z.string().min(1).max(80).trim().optional(),
    lastName: z.string().min(1).max(80).trim().optional(),
    phoneNumber: z.string().min(8).max(20).trim().nullable().optional(),
    modules: uniqueModulesSchema.optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.firstName !== undefined ||
      data.lastName !== undefined ||
      data.phoneNumber !== undefined ||
      data.modules !== undefined,
    { message: "At least one field must be provided" },
  );

export type UpdateSubAdminBody = z.infer<typeof updateSubAdminBodySchema>;
