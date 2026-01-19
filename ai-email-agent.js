#!/usr/bin/env node

/**
 * AI Email Reply Agent
 *
 * This is the REAL "Auth for Agents" demo:
 *
 * 1. Claude AI reads your emails
 * 2. Claude decides if they need a reply
 * 3. Claude composes intelligent replies
 * 4. Claude REQUESTS permission to send (via Auth-for-Agents API)
 * 5. YOU approve or deny each reply
 * 6. Only approved replies are sent
 *
 * This is Auth0 for Agents: AI has intelligence, YOU have control
 */

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');

// Load environment variables
const envContent = fs.readFileSync('.env', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const AGENT_API_KEY = process.argv[2];
const MONITOR_EMAIL = process.argv[3];
const ANTHROPIC_API_KEY = envVars.ANTHROPIC_API_KEY;
const BASE_URL = 'http://localhost:3000';
const CHECK_INTERVAL_MS = 30000; // Check every 30 seconds

if (!AGENT_API_KEY || !MONITOR_EMAIL) {
  console.error('❌ Error: Please provide your agent API key and your email');
  console.error('Usage: node ai-email-agent.js YOUR_API_KEY YOUR_EMAIL');
  console.error('\nExample: node ai-email-agent.js ak_live_xxx user@gmail.com');
  console.error('\nGet your API key from: http://localhost:3000/dashboard');
  process.exit(1);
}

if (!ANTHROPIC_API_KEY) {
  console.error('❌ Error: ANTHROPIC_API_KEY not found in .env file');
  console.error('Add it to .env: ANTHROPIC_API_KEY=sk-ant-...');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const processedEmails = new Set();

// Auth-for-Agents API wrapper
async function apiRequest(method, endpoint, body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${AGENT_API_KEY}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, options);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API request failed');
  }

  return response.json();
}

// Check if Gmail access is set up
async function ensureGmailAccess() {
  console.log('🔍 Checking Gmail OAuth connection...');

  try {
    await apiRequest('GET', '/api/services/gmail/messages?maxResults=1');
    console.log('✅ Gmail access confirmed\n');
    return true;
  } catch (error) {
    if (error.message.includes('No active Gmail connection')) {
      console.log('⚠️  No Gmail connection found. Requesting OAuth...\n');

      const oauthRequest = await apiRequest('POST', '/api/oauth/initiate', {
        service_provider_id: 'gmail',
        scopes: [
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.readonly'
        ]
      });

      console.log('🔗 Authorization Required!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`\n👉 Open this URL in your browser:\n`);
      console.log(`   ${oauthRequest.authorization_url}\n`);
      console.log('After authorizing, restart this script.\n');

      process.exit(0);
    }
    throw error;
  }
}

// Extract email header
function getHeader(message, headerName) {
  const header = message.payload?.headers?.find(h => h.name === headerName);
  return header ? header.value : 'Unknown';
}

// Decode base64 email body
function decodeBody(message) {
  if (message.payload?.body?.data) {
    return Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
  }

  // Check for multipart
  if (message.payload?.parts) {
    for (const part of message.payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
    }
  }

  return message.snippet || '';
}

// Ask Claude to analyze email and compose reply
async function analyzeAndReply(email) {
  const from = getHeader(email, 'From');
  const subject = getHeader(email, 'Subject');
  const body = decodeBody(email);

  console.log(`\n🤖 Claude is analyzing email from ${from}...`);

  const prompt = `You are an AI email assistant. You've received the following email:

FROM: ${from}
SUBJECT: ${subject}
BODY:
${body}

Your task:
1. Determine if this email needs a reply (yes/no)
2. If yes, compose a professional, helpful reply

Respond in this JSON format:
{
  "needs_reply": true/false,
  "reasoning": "why it needs/doesn't need a reply",
  "reply_subject": "Re: ...",
  "reply_body": "The HTML email body to send"
}

Important:
- Keep replies concise and professional
- Address the sender's needs
- If it's a notification/automated email, needs_reply should be false
- Reply body should be HTML formatted`;

  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: prompt
    }]
  });

  const textContent = response.content.find(c => c.type === 'text');
  if (!textContent) {
    throw new Error('No text response from Claude');
  }

  // Parse JSON response - handle control characters
  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.log('Claude response:', textContent.text);
    throw new Error('Could not parse Claude response as JSON');
  }

  // Clean up control characters in JSON string
  const cleanedJson = jsonMatch[0]
    .replace(/\\n/g, '\\\\n')     // Escape newlines
    .replace(/\\r/g, '\\\\r')     // Escape carriage returns
    .replace(/\\t/g, '\\\\t')     // Escape tabs
    .replace(/\n/g, ' ')          // Replace actual newlines with spaces
    .replace(/\r/g, ' ')          // Replace actual carriage returns
    .replace(/\t/g, ' ');         // Replace actual tabs

  let analysis;
  try {
    analysis = JSON.parse(cleanedJson);
  } catch (parseError) {
    console.log('Failed to parse JSON:', cleanedJson);
    throw parseError;
  }

  console.log(`\n📊 Claude's Analysis:`);
  console.log(`   Needs Reply: ${analysis.needs_reply ? 'YES' : 'NO'}`);
  console.log(`   Reasoning: ${analysis.reasoning}`);

  if (analysis.needs_reply) {
    console.log(`   Subject: ${analysis.reply_subject}`);
    console.log(`\n   📝 AI-Generated Reply:`);
    console.log(`   ─────────────────────────────────────────────────`);
    console.log(analysis.reply_body);
    console.log(`   ─────────────────────────────────────────────────\n`);

    // Request permission to send via Auth-for-Agents
    return await requestApprovalToSend(from, analysis.reply_subject, analysis.reply_body);
  }

  return null;
}

// Request approval to send email
async function requestApprovalToSend(to, subject, body) {
  console.log(`\n📧 Requesting permission to send reply...`);

  // Extract email from "Name <email@domain.com>" format
  const emailMatch = to.match(/<(.+?)>/);
  const cleanTo = emailMatch ? emailMatch[1] : to;

  console.log(`   To: ${cleanTo}`);
  console.log(`   Subject: ${subject}`);
  console.log(`   Body length: ${body.length} characters`);

  try {
    const result = await apiRequest('POST', '/api/services/gmail/send', {
      to: cleanTo,
      subject,
      body,
    });

    if (result.requires_approval) {
      console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
      console.log('┃  ⏸️  APPROVAL REQUIRED - This is Auth for Agents!  ┃');
      console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
      console.log('\n🤖 Claude AI wants to send this email:');
      console.log(`   To: ${cleanTo}`);
      console.log(`   Subject: ${subject}`);
      console.log(`   Priority: ${result.priority}`);
      console.log(`   Body: ${body.substring(0, 200)}...`);
      console.log(`\n👉 Go to http://localhost:3000/dashboard to approve or deny`);
      console.log(`   Approval ID: ${result.approval_id}\n`);

      // Poll for approval - pass cleanTo instead of original to
      await waitForApproval(result.approval_id, cleanTo, subject, body);
    } else {
      console.log('✅ Reply sent immediately (no approval required)');
      console.log(`   Message ID: ${result.message_id}\n`);
    }
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
  }
}

// Wait for human approval
async function waitForApproval(approvalId, to, subject, body) {
  const maxWait = 300000; // 5 minutes
  const pollInterval = 5000; // 5 seconds
  const startTime = Date.now();

  console.log('⏳ Waiting for your approval...');

  while (Date.now() - startTime < maxWait) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    try {
      const status = await apiRequest('GET', `/api/approvals/${approvalId}/status`);

      if (status.status === 'approved') {
        console.log('\n✅ APPROVED BY HUMAN!');
        console.log('   Sending email now...');
        console.log(`   To: ${to}`);
        console.log(`   Subject: ${subject}`);
        console.log(`   Body length: ${body.length} characters`);

        // Retry sending with approval_id
        const result = await apiRequest('POST', '/api/services/gmail/send', {
          to: to, // Already cleaned in the caller
          subject,
          body,
          approval_id: approvalId,
        });

        console.log('✅ Email sent successfully!');
        console.log(`   Message ID: ${result.message_id}`);
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('  This is Auth for Agents:');
        console.log('  - AI made the decision');
        console.log('  - Human had control');
        console.log('  - Only approved actions executed');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        return;
      } else if (status.status === 'rejected') {
        console.log('\n❌ REJECTED BY HUMAN');
        console.log(`   Reason: ${status.resolution_comment || 'No reason provided'}`);
        console.log('   Email will not be sent.\n');
        return;
      } else if (status.status === 'expired') {
        console.log('\n⏰ Approval request EXPIRED');
        console.log('   Email will not be sent.\n');
        return;
      }

      process.stdout.write('.');
    } catch (error) {
      console.error('\n❌ Error checking approval:', error.message);
      return;
    }
  }

  console.log('\n⏰ Timeout waiting for approval (5 minutes)\n');
}

// Monitor emails
async function checkForNewEmails() {
  try {
    // Search for recent emails
    const result = await apiRequest('GET',
      '/api/services/gmail/messages?q=is:unread&maxResults=5'
    );

    if (!result.messages || result.messages.length === 0) {
      return;
    }

    console.log(`📬 Found ${result.messages.length} unread email(s)`);

    for (const message of result.messages) {
      if (processedEmails.has(message.id)) {
        continue;
      }

      // Fetch full message
      const fullMessage = await apiRequest('GET', `/api/services/gmail/messages/${message.id}`);

      console.log(`\n📧 New Email:`);
      console.log(`   From: ${getHeader(fullMessage, 'From')}`);
      console.log(`   Subject: ${getHeader(fullMessage, 'Subject')}`);
      console.log(`   ID: ${message.id}`);

      // Let Claude analyze and potentially reply
      await analyzeAndReply(fullMessage);

      processedEmails.add(message.id);
    }
  } catch (error) {
    console.error('❌ Error checking emails:', error.message);
  }
}

// Main
async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║        🤖 AI EMAIL AGENT - Auth for Agents Demo              ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  console.log('How this works:');
  console.log('  1. Claude AI monitors your Gmail');
  console.log('  2. Claude reads new emails and decides if they need replies');
  console.log('  3. Claude composes intelligent replies');
  console.log('  4. Claude REQUESTS your permission to send');
  console.log('  5. YOU review and approve/deny in the dashboard');
  console.log('  6. Only approved replies are sent\n');
  console.log('This is the "Auth0 for Agents" concept:');
  console.log('  - AI has the intelligence');
  console.log('  - You have the control\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Ensure Gmail access
  await ensureGmailAccess();

  console.log('👀 Monitoring for new emails...');
  console.log(`   Checking every ${CHECK_INTERVAL_MS / 1000} seconds`);
  console.log(`   Press Ctrl+C to stop\n`);

  // Check immediately, then set interval
  await checkForNewEmails();

  setInterval(async () => {
    await checkForNewEmails();
  }, CHECK_INTERVAL_MS);
}

main().catch(error => {
  console.error('💥 Fatal error:', error.message);
  process.exit(1);
});
