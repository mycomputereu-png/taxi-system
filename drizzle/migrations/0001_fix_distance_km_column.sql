-- Fix distanceKm column name to distance_km
ALTER TABLE rides CHANGE COLUMN distanceKm distance_km DECIMAL(8, 2);
