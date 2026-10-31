ALTER TABLE offer ADD COLUMN product_rating DECIMAL(3,2);
ALTER TABLE offer ADD COLUMN product_rating_count INTEGER;
ALTER TABLE offer ADD COLUMN product_rating_count_type VARCHAR(10);
ALTER TABLE offer ADD CONSTRAINT valid_product_rating CHECK (
 (product_rating IS NULL AND product_rating_count IS NULL AND product_rating_count_type IS NULL)
 OR (product_rating IS NOT NULL AND product_rating BETWEEN 1 AND 5
 AND product_rating_count IS NOT NULL AND product_rating_count BETWEEN 1 AND 100000000
 AND product_rating_count_type IS NOT NULL AND product_rating_count_type IN ('ratings','reviews'))
);
