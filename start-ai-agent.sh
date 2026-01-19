#!/bin/bash

# Start AI Email Agent - Auth for Agents Demo

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║     🤖 Starting AI Email Agent - Auth for Agents Demo        ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    exit 1
fi

# Check if ANTHROPIC_API_KEY is set
if ! grep -q "ANTHROPIC_API_KEY" .env; then
    echo "❌ Error: ANTHROPIC_API_KEY not found in .env"
    echo "Please add: ANTHROPIC_API_KEY=sk-ant-..."
    exit 1
fi

# Check if API key and email were provided
if [ -z "$1" ] || [ -z "$2" ]; then
    echo "❌ Error: Please provide your agent API key and your email"
    echo ""
    echo "Usage: ./start-ai-agent.sh YOUR_AGENT_API_KEY YOUR_EMAIL"
    echo ""
    echo "Example: ./start-ai-agent.sh ak_live_xxx user@gmail.com"
    echo ""
    echo "Get your API key from: http://localhost:3000/dashboard"
    exit 1
fi

echo "✅ Environment check passed"
echo "✅ Starting AI agent..."
echo "✅ Monitoring emails for: $2"
echo ""

node ai-email-agent.js "$1" "$2"
