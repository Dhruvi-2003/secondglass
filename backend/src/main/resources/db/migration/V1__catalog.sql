CREATE TABLE ingest_lock (id INTEGER PRIMARY KEY);
INSERT INTO ingest_lock VALUES (1);
CREATE TABLE retailer (id VARCHAR(80) PRIMARY KEY, name VARCHAR(120) NOT NULL);
CREATE TABLE configuration (
 id VARCHAR(64) PRIMARY KEY, category VARCHAR(30) NOT NULL DEFAULT 'LENS',
 brand VARCHAR(80) NOT NULL, model VARCHAR(150) NOT NULL, model_code VARCHAR(100),
 mount VARCHAR(60), coverage VARCHAR(30), focal_min INTEGER, focal_max INTEGER,
 max_aperture VARCHAR(30), autofocus BOOLEAN, stabilized BOOLEAN, complete BOOLEAN NOT NULL
);
CREATE TABLE offer (
 id VARCHAR(36) PRIMARY KEY, retailer_id VARCHAR(80) NOT NULL REFERENCES retailer(id), external_key VARCHAR(120) NOT NULL,
 configuration_id VARCHAR(64) NOT NULL REFERENCES configuration(id), condition_label VARCHAR(100) NOT NULL,
 condition_notes VARCHAR(2000) NOT NULL, fungus VARCHAR(20) NOT NULL, scratches VARCHAR(20) NOT NULL,
 haze VARCHAR(20) NOT NULL, accessories VARCHAR(500), warranty_months INTEGER, warranty_details VARCHAR(1500), return_days INTEGER,
 price_paise BIGINT NOT NULL CHECK (price_paise > 0), shipping_paise BIGINT, availability VARCHAR(30) NOT NULL,
 source_url VARCHAR(2000), observed_at TIMESTAMP WITH TIME ZONE NOT NULL, demo BOOLEAN NOT NULL,
 UNIQUE (retailer_id, external_key)
);
CREATE INDEX offer_configuration ON offer(configuration_id);
CREATE TABLE import_batch (id VARCHAR(150) PRIMARY KEY, payload_hash VARCHAR(64) NOT NULL, accepted INTEGER NOT NULL, rejected INTEGER NOT NULL, created_at TIMESTAMP WITH TIME ZONE NOT NULL);
CREATE TABLE observation (
 id VARCHAR(36) PRIMARY KEY, offer_id VARCHAR(36) NOT NULL REFERENCES offer(id), batch_id VARCHAR(150) NOT NULL REFERENCES import_batch(id),
 configuration_id VARCHAR(64) NOT NULL REFERENCES configuration(id), price_paise BIGINT NOT NULL,
 availability VARCHAR(30) NOT NULL, observed_at TIMESTAMP WITH TIME ZONE NOT NULL, payload_hash VARCHAR(64) NOT NULL,
 UNIQUE (batch_id, offer_id), UNIQUE (offer_id, observed_at)
);
CREATE INDEX observation_offer_time ON observation(offer_id, observed_at);
CREATE TABLE rejected_observation (id VARCHAR(36) PRIMARY KEY, batch_id VARCHAR(150) NOT NULL REFERENCES import_batch(id), external_key VARCHAR(120), reason VARCHAR(300) NOT NULL);
CREATE TABLE usage_count (event_day DATE NOT NULL, event_name VARCHAR(40) NOT NULL, total BIGINT NOT NULL, PRIMARY KEY (event_day,event_name));
CREATE TABLE ai_usage (usage_day DATE PRIMARY KEY, attempts INTEGER NOT NULL);
