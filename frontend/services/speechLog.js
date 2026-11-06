// frontend/services/speechLog.js
/**
 * Lightweight telemetry & debug logger for Speech Recognition.
 * Keeps an in-memory ring-buffer of the latest 50 events for on-device diagnostics
 * without adding third-party tracking dependencies.
 */

const MAX_LOGS = 50;
const logBuffer = [];

export const SpeechLogType = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  RESULT: 'RESULT',
};

/**
 * Record a speech-related event into memory and console.
 * @param {'INFO'|'WARN'|'ERROR'|'RESULT'} level
 * @param {string} action - e.g. 'probe', 'start', 'result', 'error', 'permission'
 * @param {object} [details] - arbitrary metadata
 */
export function logSpeech(level, action, details = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    action,
    details,
  };

  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOGS) {
    logBuffer.shift();
  }

  if (__DEV__) {
    const prefix = `[SpeechLog:${level}] ${action}`;
    if (level === SpeechLogType.ERROR) {
      console.warn(prefix, details);
    } else {
      console.log(prefix, details);
    }
  }
}

/**
 * Get snapshot of current log entries (newest last).
 * @returns {Array<object>}
 */
export function getSpeechLogs() {
  return [...logBuffer];
}

/**
 * Clear in-memory log buffer (useful for test resets).
 */
export function clearSpeechLogs() {
  logBuffer.length = 0;
}
