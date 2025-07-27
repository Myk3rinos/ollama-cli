import readline from 'readline';
import chalk from 'chalk';

class LoadingAnimation {
    constructor() {
        this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        this.interval = null;
        this.frameIndex = 0;
        this.isRunning = false;
    }

    /**
     * Démarrer l'animation avec un message optionnel
     * @param {string} message - Message à afficher avant l'animation
     */
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.frameIndex = 0;
        
        // Démarrer l'animation
        this.interval = setInterval(() => {
            this._renderFrame();
        }, 80);
        
        // Masquer le curseur pour un meilleur rendu
        process.stdout.write('\x1B[?25l');
    }

    /**
     * Arrêter l'animation avec un message optionnel
     * @param {string} message - Message à afficher après l'arrêt
     */
    stop() {
        if (!this.isRunning) return;
        
        clearInterval(this.interval);
        this.isRunning = false;
        
        // Effacer la ligne actuelle
        readline.cursorTo(process.stdout, 0);
        readline.clearLine(process.stdout, 1);
        
        // Restaurer le curseur
        process.stdout.write('\x1B[?25h');
    }

    /**
     * Afficher la frame actuelle de l'animation
     * @private
     */
    _renderFrame() {
        const frame = this.frames[this.frameIndex];
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(chalk.blue(frame));
        
        // Passer à la frame suivante
        this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }

    /**
     * Sauvegarder la position actuelle du curseur
     * @private
     */
    _saveCursorPos() {
        // Pour une compatibilité maximale, on suppose que le curseur est au début d'une nouvelle ligne
        this.cursorPos = {
            x: process.stdout.columns ? process.stdout.columns - 1 : 0,
            y: process.stdout.rows ? process.stdout.rows - 1 : 0
        };
    }
}

export default new LoadingAnimation();
