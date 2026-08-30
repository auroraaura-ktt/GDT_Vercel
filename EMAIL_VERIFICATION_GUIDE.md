# Email Verification System - Implementation Guide

## Overview
This document explains the complete email verification system implemented for MiitVerse account registration. The system ensures users can only create accounts after verifying their email with an 8-digit verification code.

## Key Changes

### 1. **Node.js Email Service** (`server/src/utils/emailService.js`)
- **New file** that handles all email sending via Nodemailer
- Uses Gmail SMTP with App-specific passwords
- Sends HTML-formatted verification emails with 8-digit codes
- Includes connection verification function

**Features:**
- Professional HTML email template
- Automatic error handling and logging
- 15-minute code expiration handled by server

### 2. **Authentication Controller** (`server/src/controllers/authController.js`)
**Modified functions:**
- `registerUser()` - Now uses Nodemailer instead of Python subprocess
- Email MUST be sent successfully before registration completes
- If email fails, pending registration is cleaned up and user is not created
- Returns clear error messages if email sending fails

**Flow:**
```
User Registration Request
    ↓
Validate input (username, email, password)
    ↓
Check if user already exists
    ↓
Generate 8-digit verification code
    ↓
Hash password with bcrypt
    ↓
Store in pendingRegistrations (in-memory, temporary)
    ↓
ATTEMPT to send verification email
    ├─ SUCCESS → Return 201 with message
    └─ FAILURE → Delete pending registration, return 500 error
    
User Never Created in Database Until Email Confirmed!
    ↓
User submits verification code
    ↓
Validate code matches and not expired
    ↓
Create user in Neo4j database
    ↓
Return success message
```

### 3. **Python Email Script** (`send_mail.py`)
**Updated with:**
- Proper command-line argument parsing (`--email`, `--code`)
- SMTP fallback method (most reliable)
- FastAPI-mail async option (if installed)
- Validation of 8-digit code format
- Better error handling and logging

**Kept as backup** - Node.js uses this if needed

### 4. **Frontend Registration Page** (`src/pages/Register.jsx`)
**Improvements:**
- Better loading states
- Success feedback before navigation
- Disabled inputs during submission
- Clearer error messages
- Shows "Sending verification code..." instead of just "Sending code..."

### 5. **Frontend Verification Page** (`src/pages/Verify.jsx`)
**Improvements:**
- Auto-formats code input to 8 digits only
- Better validation feedback
- Shows verification status
- Includes spam folder tip
- Disabled submit until code is entered
- Shows "Verify & Create Account" for clarity

## How It Works

### Registration Flow
1. User fills out registration form (username, email, password)
2. Frontend sends to `/auth/register`
3. Server:
   - Validates input
   - Checks if user/email already exists
   - Generates random 8-digit code
   - Hashes password
   - **Stores pending registration in memory (NOT in database yet)**
   - **Sends verification email with code**
   - If email fails → Return error, delete pending registration
   - If email succeeds → Return 201 status
4. Frontend shows success message and redirects to verification page

### Verification Flow
1. User receives email with 8-digit code
2. User enters email and code on verify page
3. Frontend sends to `/auth/verify`
4. Server:
   - Validates code format (exactly 8 digits)
   - Checks pending registration exists
   - Verifies code matches
   - Checks code hasn't expired (15 minutes)
   - **Creates user in Neo4j database**
   - Removes from pending registrations
   - Returns 201 with user data
5. Frontend redirects to login page

### Security Features
- ✅ Verification code is random 8 digits
- ✅ Code expires after 15 minutes
- ✅ Users not created in database until verified
- ✅ Password is hashed with bcrypt (salt rounds: 10)
- ✅ Email validation before sending
- ✅ Prevents duplicate registrations
- ✅ Pending registrations cleared on timeout

## Configuration

### Gmail Setup (IMPORTANT!)
You must use a Gmail App Password, NOT your regular Gmail password:

1. Enable 2-Factor Authentication on Google Account
2. Go to https://myaccount.google.com/apppasswords
3. Select "Mail" and "Windows Computer"
4. Google generates a 16-character app password
5. Use this password in code (currently: `mfbw mbxh furh qwjh`)

### Environment Variables (Optional)
Create `.env` in server directory:
```env
PYTHON=python3  # Path to Python executable
JWT_SECRET=your_secret_key  # For JWT tokens
```

## Dependencies Added
- `nodemailer` - Email sending library (installed in server)
- Python requires: `fastapi-mail`, `aiosmtplib` (already in requirements.txt)

## Testing

### Test Registration
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "your-email@gmail.com",
    "password": "password123"
  }'
```

Expected response (201):
```json
{
  "message": "Verification code sent. Please check your email...",
  "email": "your-email@gmail.com"
}
```

### Test Verification
```bash
curl -X POST http://localhost:3000/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@gmail.com",
    "code": "12345678"
  }'
```

Expected response (201):
```json
{
  "message": "Email verified. Account created.",
  "user": {
    "id": "uuid",
    "username": "testuser",
    "email": "your-email@gmail.com",
    "role": "user"
  }
}
```

## Troubleshooting

### Problem: "Failed to send verification email"
**Solutions:**
1. Check Gmail credentials are correct
2. Verify Gmail App Password is used (not regular password)
3. Check internet connection
4. Ensure 2FA is enabled on Google account
5. Check Gmail hasn't blocked the connection
6. Look at server console for detailed error

### Problem: "Verification code expired"
- User took longer than 15 minutes to verify
- User must re-register to get new code
- Adjust `verificationTtlMs` in authController.js if needed (currently 15 * 60 * 1000 ms)

### Problem: User created without verification
**This should NOT happen with new code**, but if it does:
- Check that email sending didn't silently fail
- Check pendingRegistrations are being properly cleaned up
- Verify verifyUser() checks are not being bypassed

## Database Schema
Users are created in Neo4j only after verification with these properties:
- `id`: UUID (unique identifier)
- `username`: String (must be unique)
- `email`: String (must be unique, verified)
- `passwordHash`: String (bcrypt hash)
- `role`: String (default: "user")
- `verified`: Boolean (always true after registration)
- `createdAt`: ISO timestamp

## Code Examples

### Send Verification Email (Manual)
```javascript
import { sendVerificationEmail } from './utils/emailService.js'

// Send code to user
const code = '12345678'
try {
  await sendVerificationEmail('user@example.com', code)
  console.log('Email sent!')
} catch (error) {
  console.error('Failed:', error.message)
}
```

### Check Email Connection
```javascript
import { verifyEmailConnection } from './utils/emailService.js'

const isConnected = await verifyEmailConnection()
if (isConnected) {
  console.log('Email service is working!')
}
```

## Future Enhancements
1. Add resend verification code endpoint
2. Store verification codes in database instead of memory
3. Add email templates using template engines
4. Implement password reset with email verification
5. Add multi-language email support
6. Add SMS verification option
7. Rate limiting on verification attempts

## API Endpoints

### POST /auth/register
Creates a pending registration and sends verification email.

**Request:**
```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

**Response (201):**
```json
{
  "message": "Verification code sent. Please check your email...",
  "email": "user@example.com"
}
```

**Response (400):**
```json
{
  "message": "username, email, and password are required"
}
```

**Response (409):**
```json
{
  "message": "User already exists"
}
```

**Response (500):**
```json
{
  "message": "Failed to send verification email. Please try again.",
  "error": "Detailed error message"
}
```

### POST /auth/verify
Verifies email code and creates user in database.

**Request:**
```json
{
  "email": "string",
  "code": "string (8 digits)"
}
```

**Response (201):**
```json
{
  "message": "Email verified. Account created.",
  "user": {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "role": "user"
  }
}
```

**Response (400):**
```json
{
  "message": "Invalid verification code"
}
```

**Response (404):**
```json
{
  "message": "No verification pending"
}
```

## Support
For issues or questions, check:
1. Server console logs
2. Verify Gmail credentials
3. Check network connectivity
4. Review error messages in response
