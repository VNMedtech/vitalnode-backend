import { z } from "zod";
import { phoneNumberSchema } from "../../../shared/validators/phone.schema.js";
import { postalCodeSchema } from "../../../shared/validators/postalCode.schema.js";
import {
  ADDRESS_CITY_MAX_LENGTH,
  ADDRESS_COUNTRY_MAX_LENGTH,
  ADDRESS_LINE_MAX_LENGTH,
  ADDRESS_RECIPIENT_NAME_MAX_LENGTH,
  ADDRESS_STATE_MAX_LENGTH,
} from "../constants/address.constants.js";

export const createAddressBodySchema = z
  .object({
    recipientName: z
      .string()
      .trim()
      .min(1, "Recipient name is required")
      .max(ADDRESS_RECIPIENT_NAME_MAX_LENGTH),
    phoneNumber: phoneNumberSchema,
    addressLine1: z
      .string()
      .trim()
      .min(1, "Address line 1 is required")
      .max(ADDRESS_LINE_MAX_LENGTH),
    addressLine2: z
      .string()
      .trim()
      .min(1)
      .max(ADDRESS_LINE_MAX_LENGTH)
      .optional(),
    city: z
      .string()
      .trim()
      .min(1, "City is required")
      .max(ADDRESS_CITY_MAX_LENGTH),
    state: z
      .string()
      .trim()
      .min(1, "State is required")
      .max(ADDRESS_STATE_MAX_LENGTH),
    country: z
      .string()
      .trim()
      .min(1, "Country is required")
      .max(ADDRESS_COUNTRY_MAX_LENGTH),
    postalCode: postalCodeSchema,
    isDefault: z.boolean().optional(),
  })
  .strict();

export type CreateAddressBody = z.infer<typeof createAddressBodySchema>;
