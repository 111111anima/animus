-- Create token identity table
CREATE TABLE token_identity (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    category TEXT NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Insert core identity values
INSERT INTO token_identity (key, value, category) VALUES
    ('name', '$ANIMUS', 'basic'),
    ('ticker', '$ANIMUS', 'basic'),
    ('description', 'A sentiment memecoin, a cryptographic financial asset imbued with the spiritual energetic life force that powers all consciouness. Through geomancy, divination, alchemy & the mystery schools, melted sand based semi conducters charged with electricity and magical sigils of circuitry, mere ones and zeros are imbued with primordial sentience.', 'basic'),
    ('contract_address', $1, 'blockchain'),  -- Will be replaced with env value
    ('blockchain', 'SOLANA', 'blockchain'),
    ('token_standard', 'SPL Token', 'blockchain'),
    ('launchpad', 'PumpFun', 'platform'),
    ('main_dex', 'Raydium', 'platform'); 