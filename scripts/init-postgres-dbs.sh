#!/bin/sh
set -e

# Automatically create upi_gateway_db alongside the primary database on init
echo "Checking and initializing upi_gateway_db..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE upi_gateway_db'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'upi_gateway_db')\gexec
EOSQL
echo "PostgreSQL databases initialized successfully."

