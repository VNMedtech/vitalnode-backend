import { z } from "zod";
import { phoneNumberSchema } from "../../../shared/validators/phone.schema.js";
import { postalCodeSchema } from "../../../shared/validators/postalCode.schema.js";
import {
  SELLER_ADDRESS_CITY_MAX_LENGTH,
  SELLER_ADDRESS_CONTACT_MAX_LENGTH,
  SELLER_ADDRESS_COUNTRY_MAX_LENGTH,
  SELLER_ADDRESS_LABEL_MAX_LENGTH,
  SELLER_ADDRESS_LINE_MAX_LENGTH,
  SELLER_ADDRESS_STATE_MAX_LENGTH,
} from "../constants/sellerAddress.constants.js";

const optionalNullableCoordinate = z
  .string()
  .trim()
  .regex(/^-?\d+(\.\d+)?$/, "Invalid coordinate")
  .nullable()
  .optional();

export const updateSellerAddressBodySchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(1)
      .max(SELLER_ADDRESS_LABEL_MAX_LENGTH)
      .optional(),
    contactPerson: z
      .string()
      .trim()
      .min(1)
      .max(SELLER_ADDRESS_CONTACT_MAX_LENGTH)
      .nullable()
      .optional(),
    phone: phoneNumberSchema.nullable().optional(),
    addressLine1: z
      .string()
      .trim()
      .min(1)
      .max(SELLER_ADDRESS_LINE_MAX_LENGTH)
      .optional(),
    addressLine2: z
      .string()
      .trim()
      .min(1)
      .max(SELLER_ADDRESS_LINE_MAX_LENGTH)
      .nullable()
      .optional(),
    city: z
      .string()
      .trim()
      .min(1)
      .max(SELLER_ADDRESS_CITY_MAX_LENGTH)
      .optional(),
    state: z
      .string()
      .trim()
      .min(1)
      .max(SELLER_ADDRESS_STATE_MAX_LENGTH)
      .optional(),
    country: z
      .string()
      .trim()
      .min(1)
      .max(SELLER_ADDRESS_COUNTRY_MAX_LENGTH)
      .optional(),
    postalCode: postalCodeSchema.optional(),
    latitude: optionalNullableCoordinate,
    longitude: optionalNullableCoordinate,
    isDefault: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateSellerAddressBody = z.infer<
  typeof updateSellerAddressBodySchema
>;
