#!/usr/bin/env node

/**
 * Email Verification System Test Script
 * Tests the registration and verification flow
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const API_BASE = 'http://localhost:3001'
const TEST_EMAIL = 'test-' + Date.now() + '@gmail.com'
const TEST_USERNAME = 'testuser_' + Date.now()
const TEST_PASSWORD = 'TestPassword123!'

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function testRegistration() {
  console.log('\n📝 TEST 1: Registration (should send verification email)')
  console.log('─'.repeat(60))

  const payload = {
    username: TEST_USERNAME,
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  }

  try {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (response.ok) {
      console.log('✓ Registration successful (201)')
      console.log('  Message:', data.message)
      console.log('  Email:', data.email)
      return true
    } else {
      console.log('✗ Registration failed (' + response.status + ')')
      console.log('  Error:', data.message)
      return false
    }
  } catch (error) {
    console.log('✗ Request failed:', error.message)
    return false
  }
}

async function testVerification() {
  console.log('\n🔐 TEST 2: Verification with Invalid Code')
  console.log('─'.repeat(60))

  const payload = {
    email: TEST_EMAIL,
    code: '00000000', // Invalid code
  }

  try {
    const response = await fetch(`${API_BASE}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      console.log('✓ Verification correctly rejected invalid code (' + response.status + ')')
      console.log('  Error:', data.message)
      return true
    } else {
      console.log('✗ Invalid code was accepted (security issue!)')
      return false
    }
  } catch (error) {
    console.log('✗ Request failed:', error.message)
    return false
  }
}

async function testDuplicateRegistration() {
  console.log('\n🔁 TEST 3: Duplicate Registration (should fail)')
  console.log('─'.repeat(60))

  const payload = {
    username: TEST_USERNAME,
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  }

  try {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok && response.status === 409) {
      console.log('✓ Duplicate registration correctly rejected (409)')
      console.log('  Error:', data.message)
      return true
    } else {
      console.log('✗ Duplicate registration was allowed or wrong status')
      console.log('  Status:', response.status)
      console.log('  Message:', data.message)
      return false
    }
  } catch (error) {
    console.log('✗ Request failed:', error.message)
    return false
  }
}

async function testInvalidCode() {
  console.log('\n📋 TEST 4: Verification Code Format Validation')
  console.log('─'.repeat(60))

  const testCases = [
    { code: '123', expected: 'should fail' },
    { code: '123456789', expected: 'should fail' },
    { code: 'abcdefgh', expected: 'should fail' },
    { code: '', expected: 'should fail' },
  ]

  let passed = 0

  for (const testCase of testCases) {
    const payload = {
      email: 'valid@email.com',
      code: testCase.code,
    }

    try {
      const response = await fetch(`${API_BASE}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        console.log(`  ✓ Code "${testCase.code}" correctly rejected`)
        passed++
      } else {
        console.log(`  ✗ Code "${testCase.code}" was incorrectly accepted`)
      }
    } catch (error) {
      console.log(`  ✗ Request failed for code "${testCase.code}":`, error.message)
    }
  }

  console.log(`\n  Result: ${passed}/${testCases.length} format validations passed`)
  return passed === testCases.length
}

async function runAllTests() {
  console.log('\n' + '='.repeat(60))
  console.log('🧪 MiitVerse Email Verification System - Test Suite')
  console.log('='.repeat(60))

  const results = []

  // Check server is running
  console.log('\n🔍 Checking server connectivity...')
  try {
    const response = await fetch(API_BASE + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    console.log('✓ Server is running and responding')
  } catch (error) {
    console.log('✗ Cannot reach server at ' + API_BASE)
    console.log('  Make sure the server is running: npm run dev')
    process.exit(1)
  }

  // Run tests
  results.push(await testRegistration())
  await sleep(1000) // Wait between tests

  results.push(await testVerification())
  await sleep(500)

  results.push(await testDuplicateRegistration())
  await sleep(500)

  results.push(await testInvalidCode())

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 Test Summary')
  console.log('='.repeat(60))

  const passed = results.filter((r) => r).length
  const total = results.length

  console.log(`Passed: ${passed}/${total} tests`)
  console.log(`Success Rate: ${Math.round((passed / total) * 100)}%`)

  if (passed === total) {
    console.log('\n✓ All tests passed! Email verification system is working.')
  } else {
    console.log('\n⚠ Some tests failed. Check the output above.')
  }

  console.log('\n💡 Next Steps:')
  console.log('  1. Check your email for the verification code')
  console.log('  2. Visit the verification page with email: ' + TEST_EMAIL)
  console.log('  3. Enter the 8-digit code from the email')
  console.log('  4. Account should be created after verification')

  console.log('\n' + '='.repeat(60) + '\n')

  process.exit(passed === total ? 0 : 1)
}

runAllTests().catch((error) => {
  console.error('Test suite failed:', error)
  process.exit(1)
})
