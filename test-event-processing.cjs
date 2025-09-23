#!/usr/bin/env node

/**
 * Test script to send a test event to the event processing server
 * and verify git repository info is being retrieved
 */

const http = require('http');

// Sample Claude event that matches the expected format
const testEvent = {
  sessionId: 'test-session-' + Date.now(),
  type: 'user-message',
  timestamp: Date.now(),
  message: 'Test message for event processing',
  workingDirectory: process.cwd(), // Use current directory which is a git repo
  files: [
    {
      path: './test-file.ts',
      action: 'read'
    }
  ]
};

// Function to send event to server
function sendEvent(port) {
  const data = JSON.stringify(testEvent);

  const options = {
    hostname: 'localhost',
    port: port,
    path: '/claude-hook',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        console.log('Response status:', res.statusCode);
        console.log('Response body:', responseData);

        if (res.statusCode === 200) {
          resolve(JSON.parse(responseData));
        } else {
          reject(new Error(`Server returned ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

// Main test function
async function runTest() {
  console.log('=== Testing Event Processing Server ===\n');
  console.log('Current directory (git repo):', process.cwd());
  console.log('Sending test event to server on port 3043...\n');
  console.log('Event details:', JSON.stringify(testEvent, null, 2));
  console.log('\nSending request...\n');

  try {
    const result = await sendEvent(3043);
    console.log('\n✅ Event processed successfully!');
    console.log('Processing result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('\n❌ Error sending event:', error.message);
    console.log('\nTrying alternate port 3044...');

    try {
      const result = await sendEvent(3044);
      console.log('\n✅ Event processed successfully on port 3044!');
      console.log('Processing result:', JSON.stringify(result, null, 2));
    } catch (error2) {
      console.error('❌ Error on port 3044 too:', error2.message);
    }
  }
}

// Run the test
runTest();