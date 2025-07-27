import readline from 'readline';
import chalk from 'chalk';

/**
 * Demande à l'utilisateur de confirmer l'exécution d'une commande via flèches ←/→ ou ↑/↓
 * @param {string} cmd - La commande à exécuter
 * @returns {Promise<boolean>} true si l'utilisateur confirme, false sinon
 */
const confirmExecution = (cmd) => {
    return new Promise(resolve => {
        const stdin = process.stdin;
        const stdout = process.stdout;

        if (!stdin.isTTY) {
            // Fallback simple si pas en TTY
            const rl = readline.createInterface({ input: stdin, output: stdout });
            rl.question(chalk.yellow(`\nAutoriser l'exécution de "${cmd}" ? (y/N): `), answer => {
                rl.close();
                resolve(['y', 'o'].includes(answer.trim().toLowerCase()));
            });
            return;
        }

        const choices = [`Exécuter la commande`, 'Annuler'];
        let index = 0;
        let lastRenderHeight = 0;

        function render() {
            // Sauvegarder la position du curseur
            stdout.cursorTo(0);
            
            // Calculer combien de lignes on doit effacer
            const linesToClear = lastRenderHeight || 5; // Par défaut, effacer 5 lignes
            
            // Effacer les lignes précédentes
            for (let i = 0; i < linesToClear; i++) {
                stdout.clearLine(0);
                if (i < linesToClear - 1) {
                    stdout.cursorTo(0);
                    stdout.moveCursor(0, -1);
                }
            }
            
            // Revenir au début de la zone de rendu
            stdout.cursorTo(0);
            
            // Afficher le message et la commande
            const message = `${chalk.magenta(`Autoriser l'exécution de :`)}${chalk.gray(`\n"${cmd}"`)}\n`;
            
            // Afficher les choix
            const choicesText = choices.map((c, i) => 
                i === index ? chalk.blue(`> ${c}`) : `  ${c}`
            ).join('\n');
            
            const fullText = message + choicesText;
            stdout.write(fullText);
            
            // Mettre à jour la hauteur du rendu actuel
            lastRenderHeight = fullText.split('\n').length;
        }

        function cleanup(res) {
            stdout.write('\n');
            stdin.setRawMode(false);
            stdin.removeListener('data', onData);
            resolve(res);
        }

        function onData(data) {
            const s = data.toString();
            if (s === '\u0003') { // Ctrl+C
                cleanup(false);
                return;
            }
            if (s === '\r') { // Enter
                cleanup(index === 0); // true si "Exécuter"
                return;
            }
            if (s.startsWith('\u001b')) { // sequence
                // Arrow keys
                if (s === '\u001b[A' || s === '\u001b[D') {
                    index = (index + choices.length - 1) % choices.length; // left/up
                    render();
                } else if (s === '\u001b[B' || s === '\u001b[C') {
                    index = (index + 1) % choices.length; // right/down
                    render();
                }
            }
        }

        stdout.write('\n');
        stdin.setRawMode(true);
        stdin.resume();
        stdin.on('data', onData);
        render();
    });
};

export default confirmExecution;
