#!/bin/bash
# Script to run the app with production GitSync servers

export GIT_SYNC_SERVER_URL="wss://repository-traffic-controller-production.rj36caac972nm.us-east-1.cs.amazonlightsail.com"
export AUTH_SERVER_URL="https://principal-ade.com"

echo "🚀 Starting app with production GitSync configuration:"
echo "   WebSocket Server: $GIT_SYNC_SERVER_URL"
echo "   Auth Server: $AUTH_SERVER_URL"
echo ""

npm start
