import { z } from "zod";

function parseJsonValue(value: unknown): unknown {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "object") {
    return value;
  }

  return JSON.parse(String(value));
}

function parseOptionalInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return Number(value);
}

function parseNullableInt(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  return Number(value);
}

function parseNullableString(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  return String(value).trim();
}

export const optionalIntFromForm = z.preprocess(
  parseOptionalInt,
  z.number().int().min(0).optional(),
);

export const nullableIntFromForm = z.preprocess(
  parseNullableInt,
  z.number().int().min(0).nullable().optional(),
);

export const nullableStringFromForm = z.preprocess(
  parseNullableString,
  z.string().nullable().optional(),
);

export const specificationsFromForm = z.preprocess(
  (value) => {
    const parsed = parseJsonValue(value);
    return parsed === undefined ? undefined : parsed;
  },
  z.record(z.string(), z.unknown()).optional(),
);

export const nullableSpecificationsFromForm = z.preprocess(
  (value) => {
    if (value === undefined) {
      return undefined;
    }

    if (value === null || value === "") {
      return null;
    }

    return parseJsonValue(value);
  },
  z.record(z.string(), z.unknown()).nullable().optional(),
);

export const documentTypesFromForm = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    if (Array.isArray(value)) {
      return value;
    }

    return JSON.parse(String(value));
  },
  z.array(z.string().trim().min(1).max(120)).optional(),
);
