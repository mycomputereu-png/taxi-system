#!/usr/bin/env node

/**
 * Keep-alive script to prevent sandbox hibernation
 * Pings the server every 5 minutes
 */

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const PING_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

async function pingServer() {
  try {
    const response = await fetch(`${SERVER_URL}/api/health`, {
      method: 'GET',
      timeout: 10000,
    });
    
    const timestamp = new Date().toISOString();
    if (response.ok) {
      console.log(`[${timestamp}] ✅ Ping successful (${response.status})`);
    } else {
      console.log(`[${timestamp}] ⚠️ Ping returned status ${response.status}`);
    }
  } catch (error) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ❌ Ping failed:`, error.message);
  }
}

// Initial ping
console.log('🚀 Keep-alive script started');
console.log(`📍 Server URL: ${SERVER_URL}`);
console.log(`⏱️ Ping interval: 5 minutes`);
console.log('---');

pingServer();

// Set up recurring pings
setInterval(pingServer, PING_INTERVAL);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Keep-alive script stopped');
  process.exit(0);
});
