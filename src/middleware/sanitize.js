import sanitizeHtml from "sanitize-html";

/**
 * NoSQL injection prevention middleware
 * Removes any keys that start with $ or contain .
 */
export const preventNoSQLInjection = (req, res, next) => {
  const sanitizeNoSQL = (obj) => {
    if (typeof obj !== "object" || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => sanitizeNoSQL(item));
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Remove keys that start with $ or contain .
      if (key.startsWith("$") || key.includes(".")) {
        console.warn(
          `NoSQL injection attempt detected - Key: ${key}, IP: ${req.ip}`,
        );
        continue; // Skip this key
      }
      sanitized[key] = sanitizeNoSQL(value);
    }
    return sanitized;
  };

  const sanitizeInPlace = (obj) => {
    if (typeof obj !== "object" || obj === null) {
      return;
    }

    const keysToDelete = [];
    for (const [key, value] of Object.entries(obj)) {
      // Mark keys that start with $ or contain . for deletion
      if (key.startsWith("$") || key.includes(".")) {
        console.warn(
          `NoSQL injection attempt detected - Key: ${key}, IP: ${req.ip}`,
        );
        keysToDelete.push(key);
      } else if (typeof value === "object" && value !== null) {
        sanitizeInPlace(value);
      }
    }

    // Delete dangerous keys
    keysToDelete.forEach((key) => delete obj[key]);
  };

  // Sanitize request data
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeNoSQL(req.body);
  }
  if (req.query && typeof req.query === "object") {
    sanitizeInPlace(req.query);
  }
  if (req.params && typeof req.params === "object") {
    sanitizeInPlace(req.params);
  }

  next();
};

/**
 * XSS prevention middleware
 * Sanitizes all string inputs in body, query, and params
 */
export const preventXSS = (req, res, next) => {
  const sanitizeValue = (value) => {
    if (typeof value === "string") {
      return sanitizeHtml(value, {
        allowedTags: [],
        allowedAttributes: {},
      }).trim();
    }
    if (typeof value === "object" && value !== null) {
      return sanitizeObject(value);
    }
    return value;
  };

  const sanitizeObject = (obj) => {
    if (Array.isArray(obj)) {
      return obj.map((item) => sanitizeValue(item));
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeValue(value);
    }
    return sanitized;
  };

  const sanitizeObjectInPlace = (obj) => {
    if (typeof obj !== "object" || obj === null) {
      return;
    }

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        obj[key] = sanitizeHtml(value, {
          allowedTags: [],
          allowedAttributes: {},
        }).trim();
      } else if (typeof value === "object" && value !== null) {
        sanitizeObjectInPlace(value);
      }
    }
  };

  // Sanitize request data
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    sanitizeObjectInPlace(req.query);
  }
  if (req.params) {
    sanitizeObjectInPlace(req.params);
  }

  next();
};

/**
 * Combined sanitization middleware
 */
export const sanitizeInput = [preventNoSQLInjection, preventXSS];
