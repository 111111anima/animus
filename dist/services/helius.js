"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeliusAPI = void 0;
exports.startHeliusTracker = startHeliusTracker;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
const pg_1 = require("pg");
dotenv_1.default.config();
class HeliusAPI {
    constructor() {
        if (!process.env.HELIUS_API_KEY) {
            throw new Error('HELIUS_API_KEY environment variable is not set');
        }
        this.API_KEY = process.env.HELIUS_API_KEY;
        this.RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${this.API_KEY}`;
    }
    async getTokenSupply(mintAddress) {
        try {
            const response = await axios_1.default.post(this.RPC_URL, {
                jsonrpc: "2.0",
                id: 1,
                method: "getTokenSupply",
                params: [mintAddress]
            });
            const data = response.data;
            console.log('Helius Raw Response:', data);
            if (!data?.result?.value) {
                throw new Error('Invalid response from Helius API');
            }
            const supply = data.result.value.uiAmount;
            console.log('Helius Token Supply:', {
                mintAddress,
                supply,
                decimals: data.result.value.decimals,
                rawAmount: data.result.value.amount
            });
            return supply;
        }
        catch (error) {
            console.error('Failed to fetch token supply from Helius:', error);
            throw error;
        }
    }
    async getHolderCount(mintAddress) {
        try {
            const holders = new Set();
            let cursor;
            while (true) {
                const params = {
                    limit: 1000,
                    mint: mintAddress,
                    displayOptions: { showZeroBalance: false }
                };
                if (cursor)
                    params.cursor = cursor;
                const response = await axios_1.default.post(this.RPC_URL, {
                    jsonrpc: "2.0",
                    id: "holder-count",
                    method: "getTokenAccounts",
                    params
                });
                const data = response.data;
                if (!data.result?.token_accounts || data.result.token_accounts.length === 0)
                    break;
                data.result.token_accounts.forEach(account => {
                    if (BigInt(account.amount) > BigInt(0)) {
                        holders.add(account.owner);
                    }
                });
                cursor = data.result.cursor;
                if (!cursor)
                    break;
            }
            return holders.size;
        }
        catch (error) {
            if (error instanceof Error) {
                console.error('❌ Helius API Error:', error.message);
            }
            else {
                console.error('❌ Unknown Helius API Error');
            }
            throw error;
        }
    }
}
exports.HeliusAPI = HeliusAPI;
async function startHeliusTracker() {
    console.log('Initializing Helius tracker...');
    // Initial supply check
    await updateSupplyAndHolders().catch(error => {
        console.error('Error in initial supply check:', error);
    });
    // Run every 5 minutes
    setInterval(async () => {
        try {
            await updateSupplyAndHolders();
        }
        catch (error) {
            console.error('Error updating supply and holders:', error);
        }
    }, 5 * 60 * 1000);
    console.log('Helius tracker initialized');
}
async function updateSupplyAndHolders() {
    const helius = new HeliusAPI();
    const mintAddress = process.env.TOKEN_CA;
    if (!mintAddress) {
        throw new Error('TOKEN_CA environment variable not set');
    }
    try {
        const [supply, holders] = await Promise.all([
            helius.getTokenSupply(mintAddress),
            helius.getHolderCount(mintAddress)
        ]);
        // Update database
        const pool = new pg_1.Pool({
            connectionString: process.env.TIMESCALE_CONNECTION_STRING,
            ssl: { rejectUnauthorized: true }
        });
        await pool.query(`
      UPDATE token_snapshots 
      SET supply = $1, holders = $2
      WHERE time = (
        SELECT time 
        FROM token_snapshots 
        ORDER BY time DESC 
        LIMIT 1
      )
    `, [supply, holders]);
        console.log('Updated supply and holders:', { supply, holders });
        await pool.end();
    }
    catch (error) {
        console.error('Error updating supply and holders:', error);
        throw error;
    }
}
