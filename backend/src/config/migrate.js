import sqlite3 from 'sqlite3';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const dbPath = process.env.DATABASE_PATH || './database/database.sqlite';
const db = new sqlite3.Database(dbPath);

const dbAll = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const migrateTable = async (tableName, transformFn = (row) => row) => {
  console.log(`Migrando tabla: ${tableName}...`);
  try {
    const rows = await dbAll(`SELECT * FROM ${tableName}`);
    if (rows.length === 0) {
      console.log(`La tabla ${tableName} está vacía. Saltando.`);
      return;
    }

    const transformedRows = rows.map(transformFn);
    
    // Upload in chunks of 50 to avoid any limits
    const chunkSize = 50;
    for (let i = 0; i < transformedRows.length; i += chunkSize) {
      const chunk = transformedRows.slice(i, i + chunkSize);
      const { error } = await supabase.from(tableName).insert(chunk);
      if (error) {
        throw error;
      }
    }
    console.log(`Tabla ${tableName} migrada exitosamente. (${rows.length} registros)`);
  } catch (error) {
    console.error(`Error migrando tabla ${tableName}:`, error.message);
    throw error;
  }
};

const main = async () => {
  try {
    console.log('Iniciando migración de datos a Supabase...');
    
    // 1. Administrators
    await migrateTable('administrators');
    
    // 2. Properties
    await migrateTable('properties');
    
    // 3. Services
    await migrateTable('services');
    
    // 4. Debts
    await migrateTable('debts');
    
    // 5. Bank Accounts
    await migrateTable('bank_accounts');
    
    // 6. Payments
    await migrateTable('payments');
    
    // 7. Expenses
    await migrateTable('expenses');

    console.log('🎉 ¡Migración completada exitosamente!');
    db.close();
  } catch (err) {
    console.error('❌ Error en el proceso de migración:', err.message);
    db.close();
    process.exit(1);
  }
};

main();
