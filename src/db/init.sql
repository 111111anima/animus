-- Enable TimescaleDB extension (already enabled in Timescale Cloud)
-- CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Enable vector and AI capabilities
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgai;

-- Create the token snapshots table
CREATE TABLE token_snapshots (
    time TIMESTAMPTZ NOT NULL,
    marketcap_usd NUMERIC NOT NULL,
    price_usd NUMERIC NOT NULL,
    period_volume NUMERIC NOT NULL,
    supply NUMERIC,
    holders INTEGER
);

-- Convert to hypertable
SELECT create_hypertable('token_snapshots', 'time');

-- Create indexes for common query patterns
CREATE INDEX ON token_snapshots (time DESC);
CREATE INDEX ON token_snapshots (marketcap_usd);
CREATE INDEX ON token_snapshots (price_usd);
CREATE INDEX ON token_snapshots (period_volume);
CREATE INDEX ON token_snapshots (supply);
CREATE INDEX ON token_snapshots (holders);

-- Create compound indexes for time-based queries with other columns
CREATE INDEX ON token_snapshots (time DESC, marketcap_usd);
CREATE INDEX ON token_snapshots (time DESC, period_volume);
CREATE INDEX ON token_snapshots (time DESC, holders); 