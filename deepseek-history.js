// deepseek-history.js
// Centralized history management for DeepSeek CLI.

const history = [];

/**
 * Adds an entry to the history and limits its size to 20 items.
 * @param {string} entry - Line to add to the history.
 */
export function addEntry(entry) {
  history.push(entry);
  if (history.length > 20) {
    // Remove the oldest entries to keep only the last 20
    history.splice(0, history.length - 20);
  }
}

export { history };
