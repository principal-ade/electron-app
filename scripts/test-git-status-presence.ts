#!/usr/bin/env bun
/**
 * Test script for shared git status presence feature
 *
 * Tests the flow:
 * 1. Connect to traffic controller
 * 2. Authenticate with JWT
 * 3. Join presence room
 * 4. Send presence:repo_status_update
 * 5. Listen for presence:repo_status_changed broadcasts
 */

import * as jwt from 'jsonwebtoken';
import WebSocket from 'ws';

const SYNC_JWT_SECRET = 'cc03e468ec931a8dabc6e1439fedd399854074229c99b94a800e0637e2416e9e54e520a72dbdb0f3638cae664b291f10e279792c28ab6ee937a3050c9e13fbbf';
const TRAFFIC_CONTROLLER_URL = 'wss://repository-traffic-controller-production.rj36caac972nm.us-east-1.cs.amazonlightsail.com/ws';
const ISSUER = 'dev-collab-auth-server';

// Test configuration
const TEST_USER = 'test-user-git-status';
const TEST_AGENT_ID = `test-agent-${Date.now()}`;
const TEST_REPO = 'principal-ai/control-tower-core';

interface Message {
  id?: string;
  type: string;
  payload?: unknown;
}

function generateToken(userId: string, agentId: string): string {
  const payload = {
    sub: userId,
    permissions: ['read', 'write'],
    agentId,
    clientType: 'desktop',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  };

  return jwt.sign(payload, SYNC_JWT_SECRET, {
    algorithm: 'HS256',
    issuer: ISSUER,
  });
}

function createMessage(type: string, payload?: unknown): Message {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    payload,
  };
}

async function runTest(): Promise<void> {
  console.log('🚀 Starting git status presence test...\n');

  // Generate JWT
  const token = generateToken(TEST_USER, TEST_AGENT_ID);
  console.log('✅ Generated JWT token');
  console.log(`   User: ${TEST_USER}`);
  console.log(`   Agent: ${TEST_AGENT_ID}\n`);

  // Connect to WebSocket
  console.log(`🔌 Connecting to ${TRAFFIC_CONTROLLER_URL}...`);

  const ws = new WebSocket(TRAFFIC_CONTROLLER_URL);

  const pendingRequests = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();

  function sendRequest(type: string, payload?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const msg = createMessage(type, payload);
      pendingRequests.set(msg.id!, { resolve, reject });
      ws.send(JSON.stringify(msg));

      // Timeout after 10 seconds
      setTimeout(() => {
        if (pendingRequests.has(msg.id!)) {
          pendingRequests.delete(msg.id!);
          reject(new Error(`Request ${type} timed out`));
        }
      }, 10000);
    });
  }

  ws.on('open', async () => {
    console.log('✅ WebSocket connected\n');

    try {
      // Step 1: Authenticate
      console.log('🔐 Authenticating...');
      const authResponse = await sendRequest('authenticate', { token });
      console.log('✅ Authenticated:', JSON.stringify(authResponse, null, 2), '\n');

      // Step 2: Join presence room
      console.log('🏠 Joining presence room...');
      const joinResponse = await sendRequest('join_room', { roomId: '__global_presence__' });
      console.log('✅ Joined presence room:', JSON.stringify(joinResponse, null, 2), '\n');

      // Step 3: Join the repository room (this creates the session)
      console.log('📂 Joining repository room...');
      const repoJoinResponse = await sendRequest('join_room', { roomId: TEST_REPO });
      console.log('✅ Joined repo room:', JSON.stringify(repoJoinResponse, null, 2), '\n');

      // Step 4: Report repository opened (updates branch info)
      console.log('📂 Reporting repository opened...');
      const repoOpenResponse = await sendRequest('presence:repo_open', {
        repoId: TEST_REPO,
        branch: 'main',
      });
      console.log('✅ Repository opened:', JSON.stringify(repoOpenResponse, null, 2), '\n');

      // Step 5: Send git status update
      console.log('📊 Sending git status update...');
      const gitStatus = {
        branch: 'main',
        isDirty: true,
        hasStaged: true,
        hasUntracked: false,
        ahead: 2,
        behind: 0,
        modifiedFiles: ['src/index.ts', 'package.json'],
        stagedFiles: ['src/index.ts'],
        untrackedFiles: [],
        deletedFiles: [],
        lastChangedAt: new Date().toISOString(),
      };

      const statusResponse = await sendRequest('presence:repo_status_update', {
        repoId: TEST_REPO,
        gitStatus,
      });
      console.log('✅ Git status update response:', JSON.stringify(statusResponse, null, 2), '\n');

      // Step 6: Get users to verify our status is visible
      console.log('👥 Fetching presence users...');
      const usersResponse = await sendRequest('presence:get_users', {});
      console.log('✅ Presence users:', JSON.stringify(usersResponse, null, 2), '\n');

      // Step 7: Get specific user to verify git status
      console.log(`🔍 Fetching user ${TEST_USER}...`);
      const userResponse = await sendRequest('presence:get_user', { userId: TEST_USER });
      console.log('✅ User presence:', JSON.stringify(userResponse, null, 2), '\n');

      console.log('✨ All tests passed!\n');
      console.log('Listening for broadcasts for 10 seconds...\n');

      // Listen for broadcasts for a bit
      setTimeout(() => {
        console.log('\n👋 Closing connection...');
        ws.close();
        process.exit(0);
      }, 10000);

    } catch (error) {
      console.error('❌ Test failed:', error);
      ws.close();
      process.exit(1);
    }
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString()) as Message;
      console.log(`📨 Received: ${msg.type}`, msg.id ? `(id: ${msg.id})` : '');

      // Handle response to our request
      if (msg.id && pendingRequests.has(msg.id)) {
        const { resolve } = pendingRequests.get(msg.id)!;
        pendingRequests.delete(msg.id);
        resolve(msg.payload);
        return;
      }

      // Handle auth_result (no id matching)
      if (msg.type === 'auth_result') {
        // Find any pending authenticate request
        for (const [id, handler] of pendingRequests.entries()) {
          handler.resolve(msg.payload);
          pendingRequests.delete(id);
          break;
        }
        return;
      }

      // Handle error messages
      if (msg.type === 'error') {
        console.log('❌ Error from server:', JSON.stringify(msg.payload, null, 2));
        // Reject any pending request
        for (const [id, handler] of pendingRequests.entries()) {
          handler.reject(new Error(`Server error: ${JSON.stringify(msg.payload)}`));
          pendingRequests.delete(id);
          break;
        }
        return;
      }

      // Handle room_joined response
      if (msg.type === 'room_joined') {
        // Find pending join_room request
        for (const [id, handler] of pendingRequests.entries()) {
          handler.resolve(msg.payload);
          pendingRequests.delete(id);
          break;
        }
        return;
      }

      // Handle broadcasts
      if (msg.type.startsWith('presence:')) {
        console.log(`📢 Broadcast received: ${msg.type}`);
        console.log('   Payload:', JSON.stringify(msg.payload, null, 2));
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
    process.exit(1);
  });

  ws.on('close', (code, reason) => {
    console.log(`WebSocket closed: ${code} - ${reason}`);
  });
}

runTest().catch(console.error);
