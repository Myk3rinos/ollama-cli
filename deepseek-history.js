// deepseek-history.js
// Gestion centralisée de l'historique pour DeepSeek CLI.

const history = [];

/**
 * Ajoute une entrée à l'historique et limite sa taille à 20 éléments.
 * @param {string} entry - Ligne à ajouter dans l'historique.
 */
export function addEntry(entry) {
  history.push(entry);
  if (history.length > 20) {
    // Supprime les plus anciennes entrées pour conserver seulement les 20 dernières
    history.splice(0, history.length - 20);
  }
}

export { history };
