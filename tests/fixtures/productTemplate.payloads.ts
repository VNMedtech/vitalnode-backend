/** Sample base-field snapshot for create-form autofill tests. */
export const sampleBaseDefaults = {
  productName: "Dual-Head Stethoscope",
  brand: "Littmann",
  model: "Classic III",
  pricing: "8999.00",
  moq: 1,
  description: "Acoustic dual-head stethoscope for clinical use",
  details: null as string | null,
};

export function productTemplateCreationPayload(
  categoryIds: string[],
  overrides: Record<string, unknown> = {},
) {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    name: `Template ${unique}`,
    description: "Demo product template for tests",
    categoryIds,
    fields: [
      {
        key: "color",
        label: "Color",
        fieldType: "SELECT",
        options: ["White", "Black", "Blue"],
        defaultValue: "White",
        sortOrder: 0,
      },
      {
        key: "weight",
        label: "Weight",
        fieldType: "NUMBER",
        unit: "kg",
        defaultValue: 1.5,
        sortOrder: 1,
      },
      {
        key: "deliveryTime",
        label: "Delivery Time (days)",
        fieldType: "NUMBER",
        defaultValue: 7,
        sortOrder: 2,
      },
    ],
    ...overrides,
  };
}
