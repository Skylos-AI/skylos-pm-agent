-- City segmentation for multi-city prospect imports (La Paz 2026-07 batch;
-- Cochabamba / Santa Cruz batches to follow). companies.city already exists
-- since init, so this only adds the missing index for city filtering.

-- CreateIndex
CREATE INDEX "companies_city_idx" ON "companies"("city");
