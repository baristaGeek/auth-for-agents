# Auth for Agents

**Auth0 for AI agents** - Give AI agents access to your services with human-in-the-loop approval.

## Why This is Cool

Once you give an AI agent your OAuth tokens, it can do anything with no oversight. Auth for Agents sits between AI and your services, requiring your approval before actions execute. You maintain full control and get a complete audit trail of everything your AI agents do.

## Getting Started

1. **Go to the dashboard** at `https://auth-for-agents.vercel.app/`
2. **Create an API key** - Go to "Agents" → "New Agent" and copy your API key
3. **Create approval flows** - Go to "Rules" → "New Rule" to define when actions need approval
4. **(Optional) Test run with the sample app**:
   Include your API key in the Authorization header:
   ```bash
   ./start-ai-agent.sh YOUR_API_KEY YOUR_EMAIL@gmail.com
   ```
   Send a test email to yourself or test against another custom rule, to see how the agent reasons about each email
5. **(Optional) Integrate your agent to your code**: Build custom agentic Gmail flows with our API and your API key
   ```bash
   curl -H "Authorization: Bearer ak_live_0212e25f9aad..." \
     https://your-app.com/api/endpoint
   ```
   Example: Request Gmail Access
      ```bash
      curl -X POST https://your-app.com/api/oauth/initiate \
        -H "Authorization: Bearer ak_live_0212e25f9aad..." \
        -H "Content-Type: application/json" \
        -d '{
          "service_provider_id": "gmail",
          "scopes": ["gmail.send", "gmail.readonly"]
        }'
   ```

That's it. The AI agent will monitor your Gmail, compose replies, and ask for your approval before sending.


## License

MIT
# auth-for-agents
