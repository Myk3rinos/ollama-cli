#!/usr/bin/env node

/**
 * DeepSeek CLI - Interface simple pour communiquer avec DeepSeek-R1:14b
 * Version adaptée de mistral-cli pour DeepSeek-R1:14b
 * Utilise Ollama comme backend pour servir le modèle DeepSeek
 */

import readline from 'readline';
import chalk from 'chalk';
import { runAction } from './action-agent.js';
import asciiArt from './deepseek-ascii.js';
import prePrompt from './deepseek-preprompt.js';
import confirmExecution from './confirm-execution.js';
import { history, addEntry } from './deepseek-history.js';

class DeepSeekCLI {
    constructor(baseUrl = "http://localhost:11434", model = "deepseek-r1:14b") {
        this.baseUrl = baseUrl;
        this.model = model;
        this.timeout = 60000; // Timeout plus long pour DeepSeek-R1:14b
        // Historique partagé importé
        this.history = history;
        // Pré-instruction importée depuis deepseek-preprompt.js
        this.prePrompt = prePrompt;
        // Configuration de l'interface readline
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: chalk.cyan('> ')
        });
        
        console.log(chalk.cyan(asciiArt));
        console.log(chalk.gray(` Connecté à: ${this.baseUrl}`));
        console.log(chalk.gray(` Modèle: ${this.model}`));
        console.log(chalk.gray(' Tapez "exit" ou "quit" pour quitter, "clear" pour effacer l\'historique'));
        console.log(chalk.gray(' Tapez "help" pour voir les commandes disponibles\n'));
    }

    /**
     * Nettoie la réponse en supprimant les balises <think> et leur contenu
     * @param {string} response - Réponse à nettoyer
     * @returns {string} Réponse nettoyée
     */
    cleanResponse(response) {
        // Supprime les balises <think> et leur contenu
        return response.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    }

    async sendToDeepSeek(prompt) {
        try {
            const fullPrompt = this.history.length > 0 
                ? this.history.join('\n') + `\n${prompt}` 
                : prompt;
                
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.model,
                    prompt: `${this.prePrompt}\n\n${fullPrompt}`,
                    stream: false,
                    options: {
                        temperature: 0.7,
                        top_p: 0.9,
                        top_k: 40
                    }
                }),
                timeout: this.timeout
            });

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            let responseText = data.response || "Aucune réponse reçue";
            
            // Nettoyer la réponse des balises <think>
            responseText = this.cleanResponse(responseText);
            
            // Mise à jour de l'historique
            addEntry(`Utilisateur: ${prompt}`);
            addEntry(`DeepSeek: ${responseText}`);
            
            
            
            return responseText;
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                return chalk.red('❌ Erreur: Impossible de se connecter à Ollama. Vérifiez qu\'Ollama est démarré et que le modèle deepseek-r1:14b est installé.');
            }
            if (error.name === 'TimeoutError') {
                return chalk.red('❌ Erreur: Timeout - DeepSeek-R1 prend du temps à réfléchir. Essayez une question plus simple.');
            }
            return chalk.red(`❌ Erreur: ${error.message}`);
        }
    }

    async processInput(input) {
        const trimmedInput = input.trim();
        
        // Commandes de sortie
        if (trimmedInput === 'exit' || trimmedInput === 'quit') {
            console.log(chalk.yellow('Au revoir !'));
            this.rl.close();
            process.exit(0);
        }
        
        // Effacer l'historique
        if (trimmedInput === 'clear') {
            this.history = [];
            console.log(chalk.green('✅ Historique effacé'));
            this.rl.prompt();
            return;
        }
        
        // Aide
        if (trimmedInput === 'help') {
            console.log(chalk.cyan('\n📖 Commandes disponibles:'));
            console.log(chalk.gray('  exit/quit  - Quitter le programme'));
            console.log(chalk.gray('  clear      - Effacer l\'historique de conversation'));
            console.log(chalk.gray('  help       - Afficher cette aide'));
            console.log(chalk.gray('  status     - Vérifier la connexion au modèle'));
            console.log(chalk.cyan('\n💡 Utilisation:'));
            console.log(chalk.gray('  - Posez des questions normales pour une conversation'));
            console.log(chalk.gray('  - Demandez des actions système pour exécuter des commandes'));
            console.log(chalk.gray('  - Exemple: "liste les fichiers" → exécute ls -la'));
            console.log(chalk.gray('  - Exemple: "explique-moi Git" → conversation normale\n'));
            this.rl.prompt();
            return;
        }
        
        // Vérifier le statut
        if (trimmedInput === 'status') {
            console.log(chalk.blue('🔍 Vérification de la connexion...'));
            try {
                const testResponse = await fetch(`${this.baseUrl}/api/tags`);
                if (testResponse.ok) {
                    const models = await testResponse.json();
                    const hasDeepSeek = models.models?.some(m => m.name.includes('deepseek-r1'));
                    if (hasDeepSeek) {
                        console.log(chalk.green('✅ Connexion OK - DeepSeek-R1:14b disponible'));
                    } else {
                        console.log(chalk.yellow('⚠️  Connexion OK mais DeepSeek-R1:14b non trouvé'));
                        console.log(chalk.gray('   Installez avec: ollama pull deepseek-r1:14b'));
                    }
                } else {
                    console.log(chalk.red('❌ Erreur de connexion à Ollama'));
                }
            } catch (error) {
                console.log(chalk.red('❌ Impossible de se connecter à Ollama'));
            }
            this.rl.prompt();
            return;
        }
        
        // Entrée vide
        if (!trimmedInput) {
            this.rl.prompt();
            return;
        }
        
        // Traitement de la demande
        console.log(chalk.blue('...'));
        // console.log(chalk.blue('🤔 DeepSeek réfléchit...'));
        const response = await this.sendToDeepSeek(trimmedInput);
        
        // ----------------------------------------------------------------------
        // Vérifier si c'est une action
        if (response.startsWith('ACTION:')) {
            let command = response.replace('ACTION:', '').trim();
            // Nettoyer markdown / backticks éventuels
            command = command.replace(/^[\s`]+|[`]+$/g, '').trim();
            
            if (!command) {
                // Pas de commande valable, afficher comme réponse normale
                console.log(chalk.white('\n' + response.replace(/^ACTION:/i, '').trim() + '\n'));
                this.rl.prompt();
                return;
            }
            
            // Demander confirmation utilisateur
            const ok = await confirmExecution(command);
            if (ok) {
                try {
                    const output = await runAction(command);
                    console.log(output);
                    this.rl.prompt();
                    return;
                } catch (error) {
                    console.log(chalk.red(`❌ Erreur d'exécution: ${error.message}`));
                    this.rl.prompt();
                    return;
                }
            }
            // Ne pas appeler rl.prompt() ici, il sera appelé automatiquement
        } else {
            // Réponse normale
            console.log(chalk.white('\n' + response + '\n'));
            this.rl.prompt();
            return;
        }
        
        // this.rl.prompt();
    }

    // Utilise la fonction confirmExecution importée

    start() {
        console.log(chalk.green('🚀 DeepSeek-R1:14b CLI démarré !'));
        console.log(chalk.gray('Tapez "help" pour voir les commandes disponibles\n'));
        
        this.rl.prompt();
        
        this.rl.on('line', async (input) => {
            await this.processInput(input);
        });
        
        this.rl.on('close', () => {
            // console.log(chalk.yellow('\nAu revoir !'));
            process.exit(0);
        });
        
        // Gestion des signaux
        process.on('SIGINT', () => {
            console.log(chalk.yellow('\n\nInterruption détectée. Tapez "exit" pour quitter proprement.'));
            this.rl.prompt();
        });
    }
}

// Fonction principale
async function main() {
    const args = process.argv.slice(2);
    let baseUrl = "http://localhost:11434";
    let model = "deepseek-r1:14b";
    
    // Parsing des arguments
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--url' && i + 1 < args.length) {
            baseUrl = args[i + 1];
            i++;
        } else if (args[i] === '--model' && i + 1 < args.length) {
            model = args[i + 1];
            i++;
        } else if (args[i] === '--help') {
            console.log(chalk.cyan('DeepSeek-R1:14b CLI'));
            console.log(chalk.gray('Usage: node deepseek-cli.js [options]'));
            console.log(chalk.gray('Options:'));
            console.log(chalk.gray('  --url <url>     URL du serveur Ollama (défaut: http://localhost:11434)'));
            console.log(chalk.gray('  --model <name>  Nom du modèle (défaut: deepseek-r1:14b)'));
            console.log(chalk.gray('  --help          Afficher cette aide'));
            process.exit(0);
        }
    }
    
    const cli = new DeepSeekCLI(baseUrl, model);
    cli.start();
}

// Point d'entrée
main().catch(error => {
    console.error(chalk.red('Erreur fatale:'), error);
    process.exit(1);
});
