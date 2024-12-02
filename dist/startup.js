"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const healthCheck_1 = require("./services/healthCheck");
const animusLLM_1 = require("./services/animusLLM");
const dotenv_1 = __importDefault(require("dotenv"));
const dexscreener_1 = require("./services/dexscreener");
const helius_1 = require("./services/helius");
dotenv_1.default.config();
async function startup() {
    try {
        console.log('Starting Animus services...');
        // Wait for health check to initialize
        await new Promise((resolve) => {
            healthCheck_1.healthCheck.once('healthy', () => resolve());
            healthCheck_1.healthCheck.once('error', (error) => {
                console.error('Failed to start health check:', error);
                process.exit(1);
            });
        });
        // Start DexScreener service
        console.log('Starting DexScreener service...');
        await (0, dexscreener_1.startDexScreener)();
        // Start Helius tracker
        console.log('Starting Helius tracker...');
        await (0, helius_1.startHeliusTracker)();
        // Initialize AnimusLLM
        await animusLLM_1.animusLLM.initialize();
        console.log('All services started successfully');
    }
    catch (error) {
        console.error('Startup failed:', error);
        process.exit(1);
    }
}
// Add process handlers
process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
    try {
        await animusLLM_1.animusLLM.cleanup();
    }
    finally {
        process.exit(1);
    }
});
process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    try {
        await animusLLM_1.animusLLM.cleanup();
    }
    finally {
        process.exit(1);
    }
});
process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully');
    try {
        await animusLLM_1.animusLLM.cleanup();
        process.exit(0);
    }
    catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
});
process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully');
    try {
        await animusLLM_1.animusLLM.cleanup();
        process.exit(0);
    }
    catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
});
startup();
