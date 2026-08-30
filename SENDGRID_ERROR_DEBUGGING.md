# SendGrid Error Debugging Guide

## Common SendGrid Errors on Render

### Error: 401 Unauthorized
```
SendGrid API key is invalid or expired
```
**Solution:**
- Verify `SENDGRID_API_KEY` in Render environment variables
- Check the key starts with `SG.`
- Regenerate API key in SendGrid dashboard if needed

### Error: 403 Forbidden
```
SendGrid API key does not have permission to send emails
```
**Solution:**
- Check API key has "Mail Send" permission
- Regenerate with correct permissions in SendGrid dashboard

### Error: 400 Bad Request
```
SendGrid request validation error
```
**Common causes:**
1. **Invalid "from" email** - Not verified in SendGrid
   - Solution: Verify sender domain or use SendGrid's default email
   
2. **Invalid "to" email** - Malformed email address
   - Solution: Validate recipient email format before sending
   
3. **Empty email content** - No subject or body
   - Solution: Ensure both HTML and text content exist

### Error: 429 Too Many Requests
```
SendGrid rate limit exceeded
```
**Solution:**
- Free tier: 100 emails/day limit
- Upgrade plan or implement queue system

---

## How to Debug on Render

### Step 1: Enable Detailed Logging
Check Render logs to see full error response:
1. Go to Render dashboard
2. Select your service
3. Click **Logs** tab
4. Look for "SendGrid error body" with full JSON response

### Step 2: Check Your Configuration

**In Render Environment:**
```
SENDGRID_API_KEY=SG.xxxxx       ← Check starts with "SG."
SENDGRID_FROM_EMAIL=your@email  ← Check is valid
SENDGRID_FROM_NAME=YourName     ← Check not empty
```

**In code:**
- `to: email` ← Make sure recipient email is valid
- `subject` ← Make sure not empty
- `html` ← Make sure not empty

### Step 3: Test Locally First
```bash
cd server
npm run dev

# In another terminal
node test-email-verification.js
```

If it works locally but fails on Render, the issue is likely:
- API key not set on Render
- Environment variable mismatch
- Sender email not verified on Render's domain

---

## Testing with cURL (Advanced)

Test SendGrid directly:
```bash
curl --request POST \
  --url https://api.sendgrid.com/v3/mail/send \
  --header 'Authorization: Bearer SG.your_api_key' \
  --header 'Content-Type: application/json' \
  --data '{
    "personalizations": [{
      "to": [{"email": "test@example.com"}]
    }],
    "from": {"email": "your@email.com", "name": "Your Name"},
    "subject": "Test Email",
    "content": [{
      "type": "text/html",
      "value": "<h1>Test</h1>"
    }]
  }'
```

---

## SendGrid Dashboard Checks

1. **API Keys section:**
   - Verify key is active
   - Check permissions include "Mail Send"

2. **Sender Authentication:**
   - Check sender email is verified
   - Or verify entire domain

3. **Email Activity:**
   - Monitor successful/failed sends
   - Check delivery status

4. **Settings → API Keys:**
   - Create new key with "Mail Send" only permission
   - Copy and paste into Render environment

---

## Quick Checklist

- [ ] API key starts with `SG.`
- [ ] API key set in Render environment variables
- [ ] Sender email is verified in SendGrid
- [ ] Recipient email format is valid
- [ ] Email subject is not empty
- [ ] Email body (HTML/text) is not empty
- [ ] No typos in environment variable names
- [ ] Restart Render service after env changes

---

## Real-world Example: Complete Error Response

If you see:
```json
{
  "errors": [{
    "message": "The from email address contains invalid characters",
    "field": "from.email",
    "help": null
  }]
}
```

**Fix:** Update `SENDGRID_FROM_EMAIL` to use a valid email format

---

## Get Help

1. **Render Logs** → Full error response
2. **SendGrid Dashboard → Email Activity** → Check delivery status
3. **Check error.response.body** → Full error details (with improved logging)
