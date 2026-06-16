/**
 * OpenAPI / Swagger configuration — served at /api-docs.
 */

export const swaggerOptions = {
  openapi: "3.0.0",
  info: {
    title: "Medical Equipment Marketplace API",
    version: "1.0.0",
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
};
