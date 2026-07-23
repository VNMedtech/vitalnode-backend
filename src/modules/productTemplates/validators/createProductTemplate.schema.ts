import { z } from "zod";
import {
  PRODUCT_TEMPLATE_DESCRIPTION_MAX_LENGTH,
  PRODUCT_TEMPLATE_FIELD_KEY_MAX_LENGTH,
  PRODUCT_TEMPLATE_FIELD_LABEL_MAX_LENGTH,
  PRODUCT_TEMPLATE_FIELD_TYPES,
  PRODUCT_TEMPLATE_FIELD_UNIT_MAX_LENGTH,
  PRODUCT_TEMPLATE_NAME_MAX_LENGTH,
} from "../constants/productTemplate.constants.js";

const fieldKeySchema = z
  .string()
  .trim()
  .min(1, "Field key is required")
  .max(PRODUCT_TEMPLATE_FIELD_KEY_MAX_LENGTH)
  .regex(
    /^[a-z][a-zA-Z0-9_]*$/,
    "Field key must start with a lowercase letter and contain only letters, numbers, and underscores",
  );

export const productTemplateFieldInputSchema = z
  .object({
    key: fieldKeySchema,
    label: z
      .string()
      .trim()
      .min(1, "Field label is required")
      .max(PRODUCT_TEMPLATE_FIELD_LABEL_MAX_LENGTH),
    fieldType: z.enum(PRODUCT_TEMPLATE_FIELD_TYPES),
    options: z.unknown().optional(),
    defaultValue: z.unknown().optional(),
    unit: z
      .string()
      .trim()
      .max(PRODUCT_TEMPLATE_FIELD_UNIT_MAX_LENGTH)
      .nullable()
      .optional(),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .superRefine((field, ctx) => {
    if (
      (field.fieldType === "SELECT" || field.fieldType === "MULTISELECT") &&
      field.options === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Options are required for SELECT and MULTISELECT fields",
      });
    }
  });

export const createProductTemplateBodySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Template name is required")
      .max(PRODUCT_TEMPLATE_NAME_MAX_LENGTH),
    description: z
      .string()
      .trim()
      .max(PRODUCT_TEMPLATE_DESCRIPTION_MAX_LENGTH)
      .nullable()
      .optional(),
    isActive: z.boolean().optional(),
    categoryIds: z.array(z.string().uuid("Invalid category ID")).optional(),
    fields: z.array(productTemplateFieldInputSchema).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!data.fields) {
      return;
    }
    const keys = new Set<string>();
    for (const [index, field] of data.fields.entries()) {
      if (keys.has(field.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["fields", index, "key"],
          message: `Duplicate field key: ${field.key}`,
        });
      }
      keys.add(field.key);
    }
  });

export type CreateProductTemplateBody = z.infer<
  typeof createProductTemplateBodySchema
>;

export const updateProductTemplateBodySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(PRODUCT_TEMPLATE_NAME_MAX_LENGTH)
      .optional(),
    description: z
      .string()
      .trim()
      .max(PRODUCT_TEMPLATE_DESCRIPTION_MAX_LENGTH)
      .nullable()
      .optional(),
    isActive: z.boolean().optional(),
    categoryIds: z.array(z.string().uuid("Invalid category ID")).optional(),
    fields: z.array(productTemplateFieldInputSchema).optional(),
  })
  .strict()
  .refine(
    (data) =>
      Object.keys(data).some(
        (key) => data[key as keyof typeof data] !== undefined,
      ),
    { message: "At least one field must be provided" },
  )
  .superRefine((data, ctx) => {
    if (!data.fields) {
      return;
    }
    const keys = new Set<string>();
    for (const [index, field] of data.fields.entries()) {
      if (keys.has(field.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["fields", index, "key"],
          message: `Duplicate field key: ${field.key}`,
        });
      }
      keys.add(field.key);
    }
  });

export type UpdateProductTemplateBody = z.infer<
  typeof updateProductTemplateBodySchema
>;

export const replaceProductTemplateFieldsBodySchema = z
  .object({
    fields: z.array(productTemplateFieldInputSchema),
  })
  .strict()
  .superRefine((data, ctx) => {
    const keys = new Set<string>();
    for (const [index, field] of data.fields.entries()) {
      if (keys.has(field.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["fields", index, "key"],
          message: `Duplicate field key: ${field.key}`,
        });
      }
      keys.add(field.key);
    }
  });

export type ReplaceProductTemplateFieldsBody = z.infer<
  typeof replaceProductTemplateFieldsBodySchema
>;

export const replaceProductTemplateCategoriesBodySchema = z
  .object({
    categoryIds: z.array(z.string().uuid("Invalid category ID")),
  })
  .strict();

export type ReplaceProductTemplateCategoriesBody = z.infer<
  typeof replaceProductTemplateCategoriesBodySchema
>;
