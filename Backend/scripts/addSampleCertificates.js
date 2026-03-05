// Script to add sample certificate data for testing
import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

// Database configuration from environment variables
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function addSampleCertificates() {
  const client = await pool.connect();
  
  try {
    console.log('Connecting to database...');
    console.log(`Host: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
    console.log(`Database: ${process.env.DB_NAME}`);
    console.log(`User: ${process.env.DB_USER}`);
    
    // First, check if certificates table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'certificates'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ Certificates table does not exist. Creating it...');
      
      // Create the certificates table
      await client.query(`
        CREATE TABLE IF NOT EXISTS public.certificates (
          id SERIAL PRIMARY KEY,
          certificate_type VARCHAR(255) NOT NULL,
          property_id TEXT,
          hotel_name TEXT,
          certificate_number VARCHAR(255),
          issue_date DATE,
          expiry_date DATE,
          issued_by TEXT,
          notes TEXT,
          is_active BOOLEAN DEFAULT TRUE,
          document_name TEXT,
          document_mime TEXT,
          document_data BYTEA,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      
      console.log('✅ Certificates table created');
    } else {
      console.log('✅ Certificates table exists');
    }
    
    console.log('Adding sample certificates...');
    
    // Sample certificate data
    const certificates = [
      {
        certificate_type: 'Gas Safety Certificate',
        property_id: '1',
        hotel_name: 'Sample Hotel 1',
        certificate_number: 'GAS-2024-001',
        issue_date: '2024-01-15',
        expiry_date: '2025-01-15',
        issued_by: 'Gas Safe Engineer Ltd',
        notes: 'Annual gas safety inspection completed',
        is_active: true
      },
      {
        certificate_type: 'Electrical Installation (EICR)',
        property_id: '1',
        hotel_name: 'Sample Hotel 1',
        certificate_number: 'EICR-2024-001',
        issue_date: '2024-02-01',
        expiry_date: '2025-02-01',
        issued_by: 'Electrical Safety Services',
        notes: 'Electrical installation condition report',
        is_active: true
      },
      {
        certificate_type: 'Fire Safety Certificate',
        property_id: '2',
        hotel_name: 'Sample Hotel 2',
        certificate_number: 'FIRE-2023-001',
        issue_date: '2023-12-01',
        expiry_date: '2024-12-01',
        issued_by: 'Fire Safety Inspectors',
        notes: 'Fire safety assessment completed',
        is_active: true
      },
      {
        certificate_type: 'Legionella Risk Assessment',
        property_id: '1',
        hotel_name: 'Sample Hotel 1',
        certificate_number: 'LEG-2024-001',
        issue_date: '2024-01-01',
        expiry_date: '2024-07-01', // This one will be expired
        issued_by: 'Water Safety Consultants',
        notes: 'Legionella risk assessment and water testing',
        is_active: true
      }
    ];
    
    // Insert certificates
    for (const cert of certificates) {
      const query = `
        INSERT INTO certificates (
          certificate_type, property_id, hotel_name, certificate_number,
          issue_date, expiry_date, issued_by, notes, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (certificate_number) DO NOTHING
      `;
      
      const values = [
        cert.certificate_type,
        cert.property_id,
        cert.hotel_name,
        cert.certificate_number,
        cert.issue_date,
        cert.expiry_date,
        cert.issued_by,
        cert.notes,
        cert.is_active
      ];
      
      await client.query(query, values);
      console.log(`✅ Added certificate: ${cert.certificate_type} - ${cert.certificate_number}`);
    }
    
    // Check the results
    const result = await client.query('SELECT COUNT(*) as count FROM certificates WHERE is_active = true');
    console.log(`\n📊 Total active certificates in database: ${result.rows[0].count}`);
    
    // Show stats
    const statsQuery = `
      SELECT
        COUNT(*) FILTER (WHERE expiry_date > (current_date + INTERVAL '30 days') AND is_active IS TRUE) AS valid_count,
        COUNT(*) FILTER (WHERE expiry_date <= (current_date + INTERVAL '30 days') AND expiry_date >= current_date AND is_active IS TRUE) AS expiring_count,
        COUNT(*) FILTER (WHERE expiry_date < current_date AND is_active IS TRUE) AS expired_count
      FROM certificates;
    `;
    
    const statsResult = await client.query(statsQuery);
    console.log('📈 Certificate stats:', statsResult.rows[0]);
    
  } catch (error) {
    console.error('❌ Error adding sample certificates:', error);
    console.error('Full error details:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
addSampleCertificates().catch(console.error);