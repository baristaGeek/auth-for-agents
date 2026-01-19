# Auth for Agents

**Auth0 for AI agents** - Give AI agents access to your services with human-in-the-loop approval.

## Why This is Cool

Once you give an AI agent your OAuth tokens, it can do anything with no oversight. Auth for Agents sits between AI and your services, requiring your approval before actions execute. You maintain full control and get a complete audit trail of everything your AI agents do.

## Getting Started

1. **Go to the dashboard** at `https://auth-for-agents.vercel.app/`
2. **Create an API key** - Go to "Agents" → "New Agent" and copy your API key
3. **Create approval flows** - Go to "Rules" → "New Rule" to define when actions need approval
4. **(Optional) Test run with the sample app**:
   ```bash
   ./start-ai-agent.sh YOUR_API_KEY YOUR_EMAIL@gmail.com
   ```

That's it. The AI agent will monitor your Gmail, compose replies, and ask for your approval before sending.


## License

MIT
# auth-for-agents
