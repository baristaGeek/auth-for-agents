#!/usr/bin/env node

/**
 * Test Approval Workflow
 * This script tests different email addresses to show which ones trigger approval
 */

const API_KEY = process.argv[2];
const BASE_URL = 'http://localhost:3000';

if (!API_KEY) {
  console.error('Usage: node test-approval.js YOUR_API_KEY');
  process.exit(1);
}

const testCases = [
  {
    name: 'Email to external.com domain',
    to: 'client@external.com',
    shouldTrigger: true
  },
  {
    name: 'Email to bigcompany.com',
    to: 'contact@bigcompany.com',
    shouldTrigger: false
  },
  {
    name: 'Email to myexternal.com',
    to: 'user@myexternal.com',
    shouldTrigger: true // Contains "external.com"
  },
  {
    name: 'Email to gmail.com',
    to: 'person@gmail.com',
    shouldTrigger: false
  }
];

async function testApproval(testCase) {
  const response = await fetch(`${BASE_URL}/api/approvals/request`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action_type: 'gmail.send',
      action_payload: {
        to: testCase.to,
        subject: 'Test Email',
        body: 'This is a test'
      },
      service_provider_id: 'gmail'
    })
  });

  const data = await response.json();
  return data;
}

async function runTests() {
  console.log('🧪 Testing Approval Rule Matching');
  console.log('=================================\n');

  for (const testCase of testCases) {
    console.log(`Test: ${testCase.name}`);
    console.log(`  To: ${testCase.to}`);

    const result = await testApproval(testCase);

    if (result.requires_approval) {
      console.log(`  ✅ REQUIRES APPROVAL (${result.priority})`);
      console.log(`     Approval ID: ${result.approval_id}`);
      console.log(`     Matched Rule: ${result.matched_rule?.name || 'Unknown'}`);
    } else {
      console.log(`  ⚪ No approval needed`);
    }

    console.log();
  }

  console.log('\n💡 Summary:');
  console.log('If you created a rule with pattern: to contains "@external.com"');
  console.log('Then emails to *@external.com and *@myexternal.com should require approval');
}

runTests().catch(console.error);
