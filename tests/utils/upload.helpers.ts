/** Minimal PNG buffer that passes magic-byte validation. */
export const TEST_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

/** Minimal PDF buffer that passes magic-byte validation. */
export const TEST_PDF_BUFFER = Buffer.from("%PDF-1.4 test content");
