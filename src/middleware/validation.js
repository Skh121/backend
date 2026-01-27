import { z } from "zod";
import { HTTP_STATUS, ERROR_MESSAGES } from "../utils/constants.js";

/**
 * Validation middleware factory
 * Validates request data against a Zod schema
 */
export const validate = (schema) => {
  return async (req, res, next) => {
    try {
      // Prepare data for validation
      const dataToValidate = {
        body: req.body || {},
        query: req.query || {},
        params: req.params || {},
      };

      // Validate request data
      const validated = await schema.parseAsync(dataToValidate);

      // Replace request data with validated data
      req.body = validated.body || req.body;

      // Update query and params in place (they are read-only)
      if (validated.query) {
        Object.keys(req.query).forEach((key) => delete req.query[key]);
        Object.assign(req.query, validated.query);
      }

      if (validated.params) {
        Object.keys(req.params).forEach((key) => delete req.params[key]);
        Object.assign(req.params, validated.params);
      }

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = (error.errors || []).map((err) => ({
          field: err.path ? err.path.join(".") : "unknown",
          message: err.message || "Validation error",
        }));

        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          errors:
            errors.length > 0
              ? errors
              : [{ field: "unknown", message: "Validation failed" }],
        });
      }

      // Log unexpected errors for debugging
      console.error("Validation middleware error:", error);
      next(error);
    }
  };
};
