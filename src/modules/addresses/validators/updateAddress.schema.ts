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

export const updateAddressBodySchema = z
  .object({
    recipientName: z
      .string()
      .trim()
      .min(1)
      .max(ADDRESS_RECIPIENT_NAME_MAX_LENGTH)
      .optional(),
    phoneNumber: phoneNumberSchema.optional(),
    addressLine1: z
      .string()
      .trim()
      .min(1)
      .max(ADDRESS_LINE_MAX_LENGTH)
      .optional(),
    addressLine2: z
      .string()
      .trim()
      .min(1)
      .max(ADDRESS_LINE_MAX_LENGTH)
      .nullable()
      .optional(),
    city: z
      .string()
      .trim()
      .min(1)
      .max(ADDRESS_CITY_MAX_LENGTH)
      .optional(),
    state: z
      .string()
      .trim()
      .min(1)
      .max(ADDRESS_STATE_MAX_LENGTH)
      .optional(),
    country: z
      .string()
      .trim()
      .min(1)
      .max(ADDRESS_COUNTRY_MAX_LENGTH)
      .optional(),
    postalCode: postalCodeSchema.optional(),
    isDefault: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateAddressBody = z.infer<typeof updateAddressBodySchema>;
