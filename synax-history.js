// deepseek-history.js
// Centralized history management for DeepSeek CLI.

const history = [];

/**
 * Adds an entry to the history and limits its size to 20 items.
 * @param {string} entry - Line to add to the history.
 */
export function addEntry(entry) {
  // Add HISTORY: prefix to the entry
  const prefixedEntry = `HISTORY: ${entry}`;
  history.push(prefixedEntry);
  if (history.length > 20) {
    // Remove the oldest entries to keep only the last 20
    history.splice(0, history.length - 20);
  }
}

/**
 * Gets the formatted history as a single string
 * @returns {string} Formatted history with each entry on a new line
 */
function getFormattedHistory() {
  return history.join('\n');
}

export { history, getFormattedHistory };
