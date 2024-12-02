import { HeliusAPI } from './helius';
import { datasource } from './db';
import dotenv from 'dotenv';

dotenv.config();

export class SupplyTrackerService {
  private helius: HeliusAPI;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.helius = new HeliusAPI();
  }

  async start() {
    console.log('Starting Supply Tracker Service...');
    
    // Initial update
    await this.updateSupplyAndHolders();
    
    // Set up interval for regular updates
    this.updateInterval = setInterval(async () => {
      try {
        await this.updateSupplyAndHolders();
      } catch (error) {
        console.error('Error in supply tracker interval:', error);
      }
    }, 60000); // Every minute
  }

  async updateSupplyAndHolders() {
    try {
      console.log('Updating supply and holders...');
      const supply = await this.helius.getTokenSupply(process.env.TOKEN_CA!);
      const holders = await this.helius.getHolderCount(process.env.TOKEN_CA!);
      
      // First try to update existing record
      const updateResult = await datasource.query(`
        WITH latest_record AS (
          SELECT time 
          FROM token_snapshots 
          WHERE time > NOW() - INTERVAL '5 minutes'
          ORDER BY time DESC 
          LIMIT 1
        )
        UPDATE token_snapshots 
        SET supply = $1, holders = $2
        WHERE time IN (SELECT time FROM latest_record)
        RETURNING *;
      `, [supply, holders]);

      // If no recent record to update, insert new one
      if (!updateResult.rows.length) {
        const insertResult = await datasource.query(`
          INSERT INTO token_snapshots (time, supply, holders)
          VALUES (NOW(), $1, $2)
          RETURNING *;
        `, [supply, holders]);
        
        console.log('Inserted new supply/holders record:', insertResult.rows[0]);
      } else {
        console.log('Updated existing record:', updateResult.rows[0]);
      }

    } catch (error) {
      console.error('Failed to update supply and holders:', error);
    }
  }

  async stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }
}

// Start the service when this file is run directly
if (require.main === module) {
  const service = new SupplyTrackerService();
  service.start().catch(console.error);

  // Handle shutdown gracefully
  process.on('SIGINT', async () => {
    console.log('Shutting down supply tracker...');
    await service.stop();
    await datasource.end();
    process.exit(0);
  });
} 