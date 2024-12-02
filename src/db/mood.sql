-- Create mood history table
CREATE TABLE mood_journal (
    id SERIAL,
    timestamp TIMESTAMPTZ NOT NULL,
    mood TEXT NOT NULL,
    price_change_15m NUMERIC NOT NULL,
    market_context TEXT,
    embedding vector(1536)  -- For OpenAI embeddings
);

-- Create hypertable for time-series data
SELECT create_hypertable('mood_journal', 'timestamp');

-- Index for efficient mood queries
CREATE INDEX ON mood_journal (timestamp DESC, mood); 