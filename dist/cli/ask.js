"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const animusLLM_1 = require("../services/animusLLM");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function main() {
    const question = process.argv[2];
    if (!question) {
        console.error('Please provide a question as an argument');
        process.exit(1);
    }
    try {
        console.log('Initializing Animus...');
        console.log('Processing question:', question);
        const answer = await animusLLM_1.animusLLM.ask(question);
        console.log('\nAnimus:', answer);
    }
    catch (error) {
        console.error('Error:', error);
    }
    finally {
        await animusLLM_1.animusLLM.cleanup();
    }
}
// Handle process termination
process.on('SIGINT', async () => {
    console.log('\nCleaning up...');
    await animusLLM_1.animusLLM.cleanup();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('\nCleaning up...');
    await animusLLM_1.animusLLM.cleanup();
    process.exit(0);
});
main();
