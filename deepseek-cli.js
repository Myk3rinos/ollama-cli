#!/usr/bin/env node

/**
 * DeepSeek CLI - Simple interface to communicate with DeepSeek-R1:14b
 * Version adapted from mistral-cli for DeepSeek-R1:14b
 * Uses Ollama as a backend to serve the DeepSeek model
 */

import readline from 'readline';
import chalk from 'chalk';
import { runAction } from './action-agent.js';
import asciiArt from './deepseek-ascii.js';
import prePrompt from './deepseek-preprompt.js';
import confirmExecution from './confirm-execution.js';
import { history, addEntry } from './deepseek-history.js';
import loadingAnimation from './loading-animation.js';

class DeepSeekCLI {
    constructor(baseUrl = "http://localhost:11434", model = "deepseek-r1:14b") {
        this.baseUrl = baseUrl;
        this.model = model;
        this.timeout = 60000; // Longer timeout for DeepSeek-R1:14b
        // Imported shared history
        this.history = history;
        // Pre-prompt imported from deepseek-preprompt.js
        this.prePrompt = prePrompt;
        // Readline interface configuration
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: chalk.cyan('> ')
        });
        
        console.log(chalk.cyan(asciiArt));
        console.log(chalk.gray(` Connected to: ${this.baseUrl}`));
        console.log(chalk.gray(` Model: ${this.model}`));
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
                throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            let responseText = data.response || "No response received";
            
            // Nettoyer la réponse des balises <think>
            responseText = this.cleanResponse(responseText);
            
            // Mise à jour de l'historique
            addEntry(`Utilisateur: ${prompt}`);
            addEntry(`DeepSeek: ${responseText}`);
            
            
            
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
            console.log(chalk.cyan('\n💡 Usage:'));
            console.log(chalk.gray('  - Ask normal questions for a conversation'));
            console.log(chalk.gray('  - Ask system actions to execute commands'));
            console.log(chalk.gray('  - Example: "list files" → execute ls -la'));
            console.log(chalk.gray('  - Example: "explain Git" → normal conversation\n'));
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
                    const hasDeepSeek = models.models?.some(m => m.name.includes('deepseek-r1'));
                    if (hasDeepSeek) {
                        console.log(chalk.green('✅ Connection OK - DeepSeek-R1:14b available'));
                    } else {
                        console.log(chalk.yellow('⚠️  Connection OK but DeepSeek-R1:14b not found'));
                        console.log(chalk.gray('   Install with: ollama pull deepseek-r1:14b'));
                    }
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
        //         // Traitement de la demande
        // console.log(chalk.blue('...'));
        // // console.log(chalk.blue('🤔 DeepSeek réfléchit...'));
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
                    console.log(chalk.cyan(output));
                    this.rl.prompt();
                    return;
                } catch (error) {
                    console.log(chalk.red(`❌ Execution error: ${error.message}`));
                    this.rl.prompt();
                    return;
                }
            }
            // Do not call rl.prompt() here, it will be called automatically
        } else {
            // Réponse normale
            console.log(chalk.cyan('\n' + response + '\n'));
            this.rl.prompt();
            return;
        }
        
        // this.rl.prompt();
    }

    // Utilise la fonction confirmExecution importée

    start() {
        console.log(chalk.green('DeepSeek-R1:14b CLI started!'));
        // console.log(chalk.green('🚀 DeepSeek-R1:14b CLI started!'));
        console.log(chalk.gray('Type "help" to see available commands\n'));
        
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
