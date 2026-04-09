#!/usr/bin/env node

/**
 * Test script to verify presence:repo_open functionality
 */

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const SERVER_URL = 'wss://repository-traffic-controller-production.rj36caac972nm.us-east-1.cs.amazonlightsail.com/ws';
const ROOM_SECRET = 'cc03e468ec931a8dabc6e1439fedd399854074229c99b94a800e0637e2416e9e54e520a72dbdb0f3638cae664b291f10e279792c28ab6ee937a3050c9e13fbbf';
const ROOM_ID = '__global_presence__';

// Create a JWT token for authentication
const token = jwt.sign(
  {
    userId: 'test-user',
    roomId: ROOM_ID,
  },
  ROOM_SECRET,
  {
    expiresIn: '1h',
    issuer: 'dev-collab-auth-server'
  }
);

let ws;
let messageId = 1;

function generateMessageId() {
  return `test-${Date.now()}-${messageId++}`;
}

function sendMessage(type, payload) {
  const message = {
    id: generateMessageId(),
    type,
    payload,
    timestamp: Date.now()
  };
  console.log('📤 Sending:', type, payload);
  ws.send(JSON.stringify(message));
}

async function testPresenceRepoOpen() {
  return new Promise((resolve, reject) => {
    console.log('🔌 Connecting to:', SERVER_URL);
    ws = new WebSocket(SERVER_URL);

    ws.on('open', () => {
      console.log('✅ Connected to server');

      // Step 1: Authenticate
      console.log('\n📝 Step 1: Authenticating...');
      console.log('Using JWT token for roomId:', ROOM_ID);
      sendMessage('authenticate', {
        token: token
      });
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log('📥 Received:', message.type, message.payload || '');

      if (message.type === 'auth_result' || message.type === 'authenticated') {
        if (message.payload?.success !== false) {
          console.log('✅ Authenticated successfully');

          // Step 2: Join global presence room
          console.log('\n📝 Step 2: Joining __global_presence__ room...');
          sendMessage('join_room', {
            roomId: '__global_presence__'
          });
        }
      }
      else if (message.type === 'room_joined') {
        console.log('✅ Joined room:', message.payload?.roomId || message.roomId);

        if (message.payload?.roomId === '__global_presence__' || message.roomId === '__global_presence__') {
          // Step 3: Send presence:repo_open
          console.log('\n📝 Step 3: Sending presence:repo_open...');
          sendMessage('presence:repo_open', {
            repoId: 'test-owner/test-repo',
            branch: 'main'
          });
        }
      }
      else if (message.type === 'presence:repo_open') {
        console.log('✅ Received response to presence:repo_open:', message.payload);
      }
      else if (message.type === 'presence:repo_opened') {
        console.log('\n🎉 SUCCESS! Received presence:repo_opened broadcast:');
        console.log('   userId:', message.payload.userId);
        console.log('   repoId:', message.payload.repoId);
        console.log('   branch:', message.payload.branch);
        console.log('   openedAt:', new Date(message.payload.openedAt).toISOString());

        console.log('\n✅ Test passed! The server is broadcasting presence:repo_opened events.');
        ws.close();
        resolve();
      }
      else if (message.type === 'error') {
        console.error('❌ Error:', message.payload);
        ws.close();
        reject(new Error(message.payload?.message || 'Unknown error'));
      }
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      reject(error);
    });

    ws.on('close', () => {
      console.log('🔌 Disconnected from server');
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        console.error('\n❌ Test timed out - did not receive presence:repo_opened broadcast');
        ws.close();
        reject(new Error('Test timed out'));
      }
    }, 10000);
  });
}

// Run the test
console.log('🧪 Testing presence:repo_open functionality\n');
testPresenceRepoOpen()
  .then(() => {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });
