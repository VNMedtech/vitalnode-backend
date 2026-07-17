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

const optionalLatitude = z
  .string()
  .trim()
  .regex(/^-?\d+(\.\d+)?$/, "Invalid latitude")
  .optional();

const optionalLongitude = z
  .string()
  .trim()
  .regex(/^-?\d+(\.\d+)?$/, "Invalid longitude")
  .optional();

export const createSellerAddressBodySchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(1, "Label is required")
      .max(SELLER_ADDRESS_LABEL_MAX_LENGTH),
    contactPerson: z
      .string()
      .trim()
      .min(1)
      .max(SELLER_ADDRESS_CONTACT_MAX_LENGTH)
      .optional(),
    phone: phoneNumberSchema.optional(),
    addressLine1: z
      .string()
      .trim()
      .min(1, "Address line 1 is required")
      .max(SELLER_ADDRESS_LINE_MAX_LENGTH),
    addressLine2: z
      .string()
      .trim()
      .min(1)
      .max(SELLER_ADDRESS_LINE_MAX_LENGTH)
      .optional(),
    city: z
      .string()
      .trim()
      .min(1, "City is required")
      .max(SELLER_ADDRESS_CITY_MAX_LENGTH),
    state: z
      .string()
      .trim()
      .min(1, "State is required")
      .max(SELLER_ADDRESS_STATE_MAX_LENGTH),
    country: z
      .string()
      .trim()
      .min(1, "Country is required")
      .max(SELLER_ADDRESS_COUNTRY_MAX_LENGTH),
    postalCode: postalCodeSchema,
    latitude: optionalLatitude,
    longitude: optionalLongitude,
    isDefault: z.boolean().optional(),
  })
  .strict();

export type CreateSellerAddressBody = z.infer<
  typeof createSellerAddressBodySchema
>;
