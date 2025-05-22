const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// กำหนดค่า connection string สำหรับ PostgreSQL
// ใช้ environment variables สำหรับการเชื่อมต่อ (สำคัญสำหรับการ deploy)
//const connectionString = process.env.DATABASE_URL || 'postgres://avnadmin:AVNS_f55VsqPVus0il98ErN3@pg-3c45e39d-nammunla1996-5f87.j.aivencloud.com:27540/defaultdb?sslmode=require';
const connectionString = process.env.DATABASE_URL || "postgresql://postgres.ofzfxbhzkvrumsgrgogq:%40Songphon544942@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres";

// สร้าง connection pool
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
    checkServerIdentity: () => undefined
  },
  connectionTimeoutMillis: 15000,
  timezone: 'Asia/Bangkok'
});

// ฟังก์ชันสำหรับเช็คการเชื่อมต่อและเตรียมฐานข้อมูล
async function initializeDatabase() {
  console.log('กำลังเตรียมฐานข้อมูล...');
  
  const client = await pool.connect();
  
  try {
    // เริ่ม transaction
    await client.query('BEGIN');
    
    // สร้างตารางเก็บรายชื่อพนักงาน
    await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        emp_code TEXT NOT NULL UNIQUE,
        full_name TEXT NOT NULL,
        position TEXT,
        department TEXT,
        line_id TEXT,
        line_name TEXT,
        line_picture TEXT,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('ตาราง employees สร้างหรือมีอยู่แล้ว');

    // สร้างตารางเก็บบันทึกเวลา
    await client.query(`
      CREATE TABLE IF NOT EXISTS time_logs (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL,
        clock_in TIMESTAMP,
        clock_out TIMESTAMP,
        note TEXT,
        latitude_in REAL,
        longitude_in REAL,
        latitude_out REAL,
        longitude_out REAL,
        line_id TEXT,
        line_name TEXT,
        line_picture TEXT,
        status TEXT DEFAULT 'normal',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);
    console.log('ตาราง time_logs สร้างหรือมีอยู่แล้ว');

    // สร้างตารางเก็บค่า settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        setting_name TEXT NOT NULL UNIQUE,
        setting_value TEXT,
        description TEXT
      )
    `);
    console.log('ตาราง settings สร้างหรือมีอยู่แล้ว');
    
    // Commit transaction
    await client.query('COMMIT');
    
    // เพิ่มข้อมูลเริ่มต้น
    await addInitialSettings();
    await addSampleEmployees();
    
    console.log('เตรียมฐานข้อมูลเสร็จสมบูรณ์');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error initializing database:', err.message);
  } finally {
    client.release();
  }
}

// เพิ่มข้อมูลการตั้งค่าเริ่มต้น
async function addInitialSettings() {
  try {
    // ตรวจสอบว่ามีข้อมูลในตาราง settings หรือไม่
    const countResult = await pool.query('SELECT COUNT(*) as count FROM settings');
    
    if (parseInt(countResult.rows[0].count) === 0) {
      console.log('กำลังเพิ่มการตั้งค่าเริ่มต้น...');
      
      const settings = [
        { name: 'organization_name', value: 'องค์การบริหารส่วนตำบลหัวนา', desc: 'ชื่อหน่วยงาน' },
        { name: 'liff_id', value: '2001032478-VR5Akj0k', desc: 'LINE LIFF ID' },
        { name: 'line_notify_token', value: '', desc: 'Token สำหรับ Line Notify' },
        { name: 'work_start_time', value: '08:30', desc: 'เวลาเริ่มงาน' },
        { name: 'work_end_time', value: '16:30', desc: 'เวลาเลิกงาน' },
        { name: 'allowed_ip', value: '', desc: 'IP Address ที่อนุญาต' },
        { name: 'telegram_bot_token', value: '', desc: 'Token สำหรับ Telegram Bot' },
        { name: 'telegram_groups', value: '[{"name":"กลุ่มหลัก","chat_id":"","active":true}]', desc: 'กลุ่มรับการแจ้งเตือน Telegram' },
        { name: 'notify_clock_in', value: '1', desc: 'แจ้งเตือนเมื่อลงเวลาเข้า' },
        { name: 'notify_clock_out', value: '1', desc: 'แจ้งเตือนเมื่อลงเวลาออก' },
        { name: 'admin_username', value: 'admin', desc: 'ชื่อผู้ใช้สำหรับแอดมิน' },
        { name: 'admin_password', value: 'admin123', desc: 'รหัสผ่านสำหรับแอดมิน' }
      ];
      
      const insertQuery = 'INSERT INTO settings (setting_name, setting_value, description) VALUES ($1, $2, $3)';
      
      for (const setting of settings) {
        await pool.query(insertQuery, [setting.name, setting.value, setting.desc]);
      }
      
      console.log('เพิ่มการตั้งค่าเริ่มต้นเรียบร้อยแล้ว');
    }
  } catch (err) {
    console.error('Error adding initial settings:', err.message);
  }
}

// เพิ่มข้อมูลพนักงานตัวอย่าง
async function addSampleEmployees() {
  try {
    // ตรวจสอบว่ามีข้อมูลในตาราง employees หรือไม่
    const countResult = await pool.query('SELECT COUNT(*) as count FROM employees');
    
    if (parseInt(countResult.rows[0].count) === 0) {
      console.log('กำลังเพิ่มพนักงานตัวอย่าง...');
      
      const employees = [
        { code: '001', name: 'สมชาย ใจดี', position: 'ผู้จัดการ', department: 'บริหาร' },
        { code: '002', name: 'สมหญิง รักเรียน', position: 'เจ้าหน้าที่', department: 'ธุรการ' }
      ];
      
      const insertQuery = 'INSERT INTO employees (emp_code, full_name, position, department) VALUES ($1, $2, $3, $4)';
      
      for (const emp of employees) {
        await pool.query(insertQuery, [emp.code, emp.name, emp.position, emp.department]);
      }
      
      console.log('เพิ่มพนักงานตัวอย่างเรียบร้อยแล้ว');
    }
  } catch (err) {
    console.error('Error adding sample employees:', err.message);
  }
}

// เริ่มต้นเตรียมฐานข้อมูล
initializeDatabase();

// สร้าง helper functions สำหรับ query
const db = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool: pool
};

module.exports = db;
