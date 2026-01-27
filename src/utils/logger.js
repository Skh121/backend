import winston from "winston";

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(
    errors({ stack: true }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  ),
  defaultMeta: { service: "shopping-platform-api" },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: combine(colorize(), consoleFormat),
    }),
    // File transport for errors
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      format: combine(timestamp(), winston.format.json()),
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: "logs/combined.log",
      format: combine(timestamp(), winston.format.json()),
    }),
  ],
});

// Create logs directory if it doesn't exist
import { mkdirSync } from "fs";
try {
  mkdirSync("logs", { recursive: true });
} catch (error) {
  // Directory already exists
}

// Don't log in test environment
if (process.env.NODE_ENV === "test") {
  logger.silent = true;
}
