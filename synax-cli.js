#!/usr/bin/env node

/**
 * CLI Interface for LLM models with Ollama
 * Supports multiple models like DeepSeek, Mistral, etc.
 * Usage: node deepseek-cli.js [model-name]
 * Example: node deepseek-cli.js mistral:7b
 */

import readline from 'readline';
import chalk from 'chalk';
import { runAction } from './action-agent.js';
import asciiArt from './synax-ascii.js';
import prePrompt from './synax-preprompt.js';
import confirmExecution from './confirm-execution.js';
import { history, addEntry } from './synax-history.js';
import loadingAnimation from './loading-animation.js';

// Default model if none is running
// const DEFAULT_MODEL = 'deepseek-r1:14b';
const DEFAULT_MODEL = 'mistral';

/**
 * Detect the currently running Ollama model
 * @returns {Promise<string>} Name of the running model or default model if none found
 */
async function detectModel() {
    try {
        const response = await fetch('http://localhost:11434/api/tags');
        if (!response.ok) throw new Error('Failed to fetch model info');
        
        const data = await response.json();
        // Get the first running model or return default
        const runningModel = data.models?.[0]?.name;
        return runningModel || DEFAULT_MODEL;
    } catch (error) {
        console.log(chalk.yellow('⚠️  Could not detect running model, using default'));
        return DEFAULT_MODEL;
    }
}

// Detect model at startup
let modelName = DEFAULT_MODEL;
(async () => {
    try {
        modelName = await detectModel();
    } catch (error) {
        console.error(chalk.red('Error detecting model:'), error.message);
    }
})();

class DeepSeekCLI {
    constructor(baseUrl = "http://localhost:11434", model = null) {
        this.baseUrl = baseUrl;
        // Use provided model or the detected model
        this.model = model || modelName;
        this.timeout = 60000; // Longer timeout for DeepSeek-R1:14b
        // Imported shared history
        this.history = history;
        // Pre-prompt imported from deepseek-preprompt.js
        this.prePrompt = prePrompt;
        // Readline interface configuration
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: chalk.blue('> ')
        });
        
        console.log(chalk.blue(asciiArt));
        console.log(chalk.gray(` Connected to: ${this.baseUrl}`));
        console.log(chalk.gray(` Model: ${this.model}${this.model === DEFAULT_MODEL ? ' (default)' : ''}`));
        // if (this.model === DEFAULT_MODEL) {
        //     console.log(chalk.yellow(' Note: Using default model. Start Ollama with another model to use it automatically.'));
        // }
        console.log(chalk.gray(' Type "exit" or "quit" to quit, "clear" to clear history'));
        console.log(chalk.gray(' Type "help" to see available commands\n'));
    }

    /**
     * Cleans the response by removing <think> tags and their content
     * @param {string} response - Response to clean
     * @returns {string} Cleaned response
     */
    cleanResponse(response) {
        // Remove <think> tags and their content
        return response.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    }

    async sendToDeepSeek(prompt) {
        try {
            // Construire le prompt complet avec une séparation claire
            let fullPrompt = '';
            
            // Ajouter le pré-prompt
            fullPrompt += this.prePrompt + '\n\n';
            
            // Ajouter l'historique s'il y en a
            if (this.history.length > 0) {
                fullPrompt += '=== CONVERSATION HISTORY ===\n';
                fullPrompt += this.history.join('\n') + '\n';
                fullPrompt += '===========================\n\n';
            }
            
            // Ajouter la question actuelle
            fullPrompt += `USER: ${prompt}\nASSISTANT:`;
                
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.model,
                    prompt: fullPrompt,
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
                throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            let responseText = data.response || "No response received";
            
            // Nettoyer la réponse des balises <think>
            responseText = this.cleanResponse(responseText);
            
            // Mise à jour de l'historique avec le format HISTORY:
            addEntry(`USER: ${prompt}`);
            addEntry(`ASSISTANT: ${responseText}`);
            
            
            
            return responseText;
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                return chalk.red('❌ Error: Unable to connect to Ollama. Verify that Ollama is running and that the deepseek-r1:14b model is installed.');
            }
            if (error.name === 'TimeoutError') {
                return chalk.red('❌ Error: Timeout - DeepSeek-R1 takes too long to think. Try a simpler question.');
            }
            return chalk.red(`❌ Error: ${error.message}`);
        }
    }

    async processInput(input) {
        const trimmedInput = input.trim();
        
        // Commandes de sortie
        if (trimmedInput === 'exit' || trimmedInput === 'quit') {
            // console.log(chalk.cyan('Goodbye!'));
            this.rl.close();
            process.exit(0);
        }
        
        // Effacer l'historique
        if (trimmedInput === 'clear') {
            this.history = [];
            console.log(chalk.green('✅ History cleared'));
            this.rl.prompt();
            return;
        }
        
        // Help
        if (trimmedInput === 'help') {
            console.log(chalk.cyan('\n📖 Available commands:'));
            console.log(chalk.gray('  exit/quit  - Quit the program'));
            console.log(chalk.gray('  clear      - Clear conversation history'));
            console.log(chalk.gray('  help       - Display this help'));
            console.log(chalk.gray('  status     - Check connection to the model'));
            // console.log(chalk.cyan('\n💡 Usage:'));
            // console.log(chalk.gray('  - Ask normal questions for a conversation'));
            // console.log(chalk.gray('  - Ask system actions to execute commands'));
            // console.log(chalk.gray('  - Example: "list files" → execute ls -la'));
            // console.log(chalk.gray('  - Example: "explain Git" → normal conversation\n'));
            this.rl.prompt();
            return;
        }
        
        // Check status
        if (trimmedInput === 'status') {
            console.log(chalk.blue('🔍 Checking connection...'));
            try {
                const testResponse = await fetch(`${this.baseUrl}/api/tags`);
                if (testResponse.ok) {
                    const models = await testResponse.json();
                    const modelNames = models.models?.map(m => m.name).sort() || [];
                    console.log(chalk.green('✅ Connection OK - Models: ' + modelNames.join(', ')));
                } else {
                    console.log(chalk.red('❌ Connection to Ollama failed'));
                }
            } catch (error) {
                console.log(chalk.red('❌ Connection to Ollama failed'));
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
        // console.log(chalk.blue('🤔 DeepSeek réfléchit...'));
        // const response = await this.sendToDeepSeek(trimmedInput);

        // Afficher l'animation de chargement
        loadingAnimation.start();
        let response;
        try {
            response = await this.sendToDeepSeek(trimmedInput);
            loadingAnimation.stop();
        } catch (error) {
            loadingAnimation.stop();
            throw error;
        }
        
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
            
            // Ask for user confirmation
            const ok = await confirmExecution(command);
            
            if (ok) {
                try {
                    const output = await runAction(command);
                    console.log(chalk.blue('\n' + output));
                } catch (error) {
                    console.log(chalk.red(`❌ Execution error: ${error.message}`));
                }
            } else {
                // console.log(chalk.yellow('Command execution cancelled'));
            }
            
            this.rl.prompt();
            return;
            // Do not call rl.prompt() here, it will be called automatically
        } else {
            // Réponse normale
            console.log(chalk.cyan('\n' + ' ' + response + '\n'));
            this.rl.prompt();
            return;
        }
        
        // this.rl.prompt();
    }

    start() {
        console.log(chalk.green(` ${this.model} CLI started!`));
        console.log(chalk.gray(' Type "help" to see available commands\n'));
        
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
            console.log(chalk.yellow('\n\nInterruption detected. Type "exit" to quit properly.'));
            this.rl.prompt();
        });
    }
}

// Fonction principale
async function main() {
    const args = process.argv.slice(2);
    let baseUrl = "http://localhost:11434";
    let model = modelName;
    
    // Parsing des arguments
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--url' && i + 1 < args.length) {
            baseUrl = args[i + 1];
            i++;
        } else if (args[i] === '--model' && i + 1 < args.length) {
            model = args[i + 1];
            i++;
        } else if (args[i] === '--help') {
            console.log(chalk.cyan('Synax CLI'));
            console.log(chalk.gray('Usage: node synax-cli.js [options]'));
            console.log(chalk.gray('Options:'));
            console.log(chalk.gray('  --url <url>     URL of the Ollama server (default: http://localhost:11434)'));
            console.log(chalk.gray('  --model <name>  Name of the model (default: deepseek-r1:14b)'));
            console.log(chalk.gray('  --help          Display this help'));
            process.exit(0);
        }
    }
    
    const cli = new DeepSeekCLI(baseUrl, model);
    cli.start();
}

// Point d'entrée
main().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
});
