/**
 * @module logger
 * Centralised logging utility for EcoTrace. Wraps `console` methods behind
 * a structured API so logging can be silenced, filtered, or redirected
 * without touching call-sites across the codebase.
 */

/** @type {"debug"|"info"|"warn"|"error"|"silent"} */
const LOG_LEVEL = "warn";

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };

/**
 * Returns true if the given level should be logged.
 * @param {"debug"|"info"|"warn"|"error"} level - The message severity.
 * @returns {boolean}
 */
function shouldLog(level) {
  return LEVELS[level] >= LEVELS[LOG_LEVEL];
}

/**
 * Logs a warning-level message.
 * @param {string} context - Module or function name for context.
 * @param  {...*} args - Values to log.
 */
export function logWarn(context, ...args) {
  if (shouldLog("warn")) console.warn(`[EcoTrace:${context}]`, ...args);
}

/**
 * Logs an error-level message.
 * @param {string} context - Module or function name for context.
 * @param  {...*} args - Values to log.
 */
export function logError(context, ...args) {
  if (shouldLog("error")) console.error(`[EcoTrace:${context}]`, ...args);
}

/**
 * Logs an info-level message (silenced by default).
 * @param {string} context - Module or function name for context.
 * @param  {...*} args - Values to log.
 */
export function logInfo(context, ...args) {
  if (shouldLog("info")) console.warn(`[EcoTrace:${context}]`, ...args);
}
