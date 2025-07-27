# DeepSeek CLI

Command-line interface for interacting with the DeepSeek-R1:14b model via Ollama.

![DeepSeek CLI](https://img.shields.io/badge/DeepSeek-CLI-blue)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 📋 Prerequisites

- Node.js (v14 or higher)
- Ollama installed and running (default: `http://localhost:11434`)
- DeepSeek-R1:14b model installed in Ollama:
  ```bash
  ollama pull deepseek-r1:14b
  ```

## 🚀 Installation

1. Clone this repository:
   ```bash
   git clone [REPO_URL]
   cd deepseek-cli
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## 🛠️ Usage

### Start the CLI

```bash
node deepseek-cli.js
```

### Command Line Options

- `--url [URL]`: Specify the Ollama API URL (default: `http://localhost:11434`)
- `--model [MODEL_NAME]`: Specify the model to use (default: `deepseek-r1:14b`)
- `--help`: Show help

Example:
```bash
node deepseek-cli.js --url http://localhost:11434 --model deepseek-r1:14b
```

### Available Commands

- `help`: Show help
- `status`: Check connection to Ollama
- `clear`: Clear conversation history
- `exit` or `quit`: Exit the application

## 🔄 System Command Execution

The CLI can execute system commands. To request an action, phrase your request normally. If a system action is required, the CLI will ask for confirmation before executing the command.

## 🛡️ Security

- All system commands require explicit confirmation
- Command history is limited to prevent overly long prompts
- The pre-prompt is designed to minimize unsolicited actions

## 🏗️ Project Structure

- `deepseek-cli.js`: Main entry point
- `deepseek-preprompt.js`: Instructions for the DeepSeek model
- `deepseek-history.js`: Conversation history management
- `confirm-execution.js`: Command confirmation logic
- `deepseek-ascii.js`: ASCII art for the interface
- `action-agent.js`: System command execution

## 📝 License

This project is licensed under the MIT License. See the `LICENSE` file for details.

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

---

