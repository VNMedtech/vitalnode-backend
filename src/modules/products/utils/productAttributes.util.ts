import type { ProductTemplateFieldType } from "../../../../generated/prisma/client.js";
import { ValidationError } from "../../../shared/errors/app.errors.js";

export type AttributeMap = Record<string, unknown>;

export interface TemplateFieldForValidation {
  key: string;
  label: string;
  fieldType: ProductTemplateFieldType;
  options: unknown;
  defaultValue: unknown;
  isActive: boolean;
}

export function asAttributeMap(value: unknown): AttributeMap {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as AttributeMap) };
  }
  return {};
}

export function extractTemplateDefaults(
  fields: TemplateFieldForValidation[],
): AttributeMap {
  const defaults: AttributeMap = {};
  for (const field of fields) {
    if (!field.isActive) {
      continue;
    }
    if (field.defaultValue !== undefined && field.defaultValue !== null) {
      defaults[field.key] = field.defaultValue;
    }
  }
  return defaults;
}

/**
 * Merge attributes for attach/select:
 * defaults → existing (orphans kept) → overrides.
 */
export function mergeAttributes(
  existing: AttributeMap,
  defaults: AttributeMap,
  overrides?: AttributeMap,
): AttributeMap {
  return {
    ...defaults,
    ...existing,
    ...(overrides ?? {}),
  };
}

/**
 * Apply new template defaults only for keys missing on the product.
 */
export function applyDefaultsForMissingKeys(
  existing: AttributeMap,
  defaults: AttributeMap,
  overrides?: AttributeMap,
): AttributeMap {
  const merged: AttributeMap = { ...existing };
  for (const [key, value] of Object.entries(defaults)) {
    if (!(key in merged)) {
      merged[key] = value;
    }
  }
  return {
    ...merged,
    ...(overrides ?? {}),
  };
}

function optionsList(options: unknown): unknown[] {
  if (!Array.isArray(options)) {
    return [];
  }
  return options;
}

function assertFieldValue(
  field: TemplateFieldForValidation,
  value: unknown,
): void {
  const label = field.label || field.key;

  switch (field.fieldType) {
    case "TEXT":
    case "DATE": {
      if (typeof value !== "string") {
        throw new ValidationError("Validation failed", [
          {
            field: `attributes.${field.key}`,
            message: `${label} must be a string`,
          },
        ]);
      }
      break;
    }
    case "NUMBER": {
      if (typeof value !== "number" || Number.isNaN(value)) {
        throw new ValidationError("Validation failed", [
          {
            field: `attributes.${field.key}`,
            message: `${label} must be a number`,
          },
        ]);
      }
      break;
    }
    case "BOOLEAN": {
      if (typeof value !== "boolean") {
        throw new ValidationError("Validation failed", [
          {
            field: `attributes.${field.key}`,
            message: `${label} must be a boolean`,
          },
        ]);
      }
      break;
    }
    case "SELECT": {
      const allowed = optionsList(field.options);
      if (!allowed.includes(value)) {
        throw new ValidationError("Validation failed", [
          {
            field: `attributes.${field.key}`,
            message: `${label} must be one of the allowed options`,
          },
        ]);
      }
      break;
    }
    case "MULTISELECT": {
      if (!Array.isArray(value)) {
        throw new ValidationError("Validation failed", [
          {
            field: `attributes.${field.key}`,
            message: `${label} must be an array`,
          },
        ]);
      }
      const allowed = optionsList(field.options);
      for (const item of value) {
        if (!allowed.includes(item)) {
          throw new ValidationError("Validation failed", [
            {
              field: `attributes.${field.key}`,
              message: `${label} contains an invalid option`,
            },
          ]);
        }
      }
      break;
    }
    default: {
      const exhaustive: never = field.fieldType;
      throw new ValidationError("Validation failed", [
        {
          field: `attributes.${field.key}`,
          message: `Unsupported field type: ${String(exhaustive)}`,
        },
      ]);
    }
  }
}

/**
 * Validate known active template fields; unknown/orphan keys are allowed.
 */
export function validateAttributesAgainstTemplate(
  attributes: AttributeMap,
  fields: TemplateFieldForValidation[],
): void {
  const activeFields = fields.filter((field) => field.isActive);
  const fieldByKey = new Map(activeFields.map((field) => [field.key, field]));

  for (const [key, value] of Object.entries(attributes)) {
    const field = fieldByKey.get(key);
    if (!field) {
      continue;
    }
    if (value === null || value === undefined) {
      continue;
    }
    assertFieldValue(field, value);
  }
}

export function formatAttributeDisplayValue(value: unknown): string | number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (Array.isArray(value)) {
    return value.map(String).join(", ");
  }
  return JSON.stringify(value);
}
