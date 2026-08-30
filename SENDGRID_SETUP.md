# SendGrid Email Service Setup Guide

## ✅ Migration Complete

Your MiitVerse email service has been successfully migrated from **Nodemailer (Gmail SMTP)** to **SendGrid**.

### What Changed

| Component | Before | After |
|-----------|--------|-------|
| Email Library | `nodemailer` | `@sendgrid/mail` |
| Connection | Direct SMTP to Gmail | SendGrid API |
| Reliability | Network timeout issues on Render | Works reliably on cloud platforms |
| Configuration | `EMAIL_USER`, `EMAIL_PASS` | `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` |

---

## 🚀 Setup Instructions

### Step 1: Get a SendGrid Account

1. Go to [sendgrid.com](https://sendgrid.com)
2. Sign up for a free account (includes 100 emails/day)
3. Verify your email address
4. Complete email verification to get higher limits

### Step 2: Create an API Key

1. Go to **Settings → API Keys** in SendGrid dashboard
2. Click **Create API Key**
3. Give it a name (e.g., "MiitVerse API Key")
4. Select "Full Access" or "Mail Send" permission
5. Copy the generated API key (you can only view it once!)

### Step 3: Configure Your Application

Update `server/.env` with your SendGrid credentials:

```env
SENDGRID_API_KEY=SG.your_actual_api_key_here
SENDGRID_FROM_EMAIL=noreply@miitverse.com
```

**Note:** Replace `SG.your_actual_api_key_here` with your actual API key from Step 2.

### Step 4: Configure Sender Email

**For Development (localhost):**
- `SENDGRID_FROM_EMAIL=noreply@miitverse.com` (any email works)

**For Production (Render):**
- You MUST verify the sender domain or use a SendGrid email address
- Option A: Verify your domain in SendGrid (advanced)
- Option B: Use SendGrid's default sender: `noreply@sendgrid.net`

To use SendGrid's default sender, update `.env`:
```env
SENDGRID_FROM_EMAIL=noreply@sendgrid.net
```

---

## 📝 Updated Files

### 1. `server/package.json`
- ✅ Removed: `nodemailer`
- ✅ Added: `@sendgrid/mail`

### 2. `server/src/config/env.js`
- ✅ Removed: `emailUser`, `emailPass`, `emailService`, `emailHost`, `emailPort`, `emailSecure`
- ✅ Added: `sendgridApiKey`, `sendgridFromEmail`

### 3. `server/src/utils/emailService.js`
- ✅ Completely rewritten to use SendGrid API
- ✅ Same functions: `sendVerificationEmail()`, `verifyEmailConnection()`, `sendEmail()`

### 4. `server/.env`
- ✅ Updated to use SendGrid configuration

---

## 🧪 Testing Email Service

Run the test script to verify everything works:

```bash
cd server
node test-email-verification.js
```

**Expected output:**
```
Verification email sent successfully: SG.xxxxx [message-id]
✓ Ready to handle registrations and email verifications
```

If you get an error about missing API key:
```
Email service may have issues - verification failed
```

**Solution:** Make sure `SENDGRID_API_KEY` is set correctly in `.env`

---

## 🔧 Environment Variables

### Local Development
```env
SENDGRID_API_KEY=SG.your_test_key
SENDGRID_FROM_EMAIL=noreply@miitverse.com
```

### Render Deployment
In your Render dashboard:
1. Go to your service → **Environment**
2. Add:
   ```
   SENDGRID_API_KEY = SG.your_production_key
   SENDGRID_FROM_EMAIL = noreply@miitverse.com (or your verified domain)
   ```
3. Redeploy

---

## 📊 SendGrid Free Tier Benefits

✅ 100 emails/day (free)  
✅ Unlimited recipients  
✅ Full API access  
✅ Email templates support  
✅ Detailed analytics  
✅ Reliable delivery (99.9% uptime)  

---

## ⚠️ Common Issues & Solutions

### Issue: "SendGrid API key not configured"
**Solution:** 
- Verify `SENDGRID_API_KEY` is set in `.env`
- Restart your server after updating `.env`

### Issue: "Email sending failed: Invalid email address"
**Solution:**
- Make sure recipient email is valid
- Check `SENDGRID_FROM_EMAIL` is properly configured

### Issue: "403 Forbidden - Invalid API Key"
**Solution:**
- Regenerate API key in SendGrid dashboard
- Make sure you copied the FULL key (starts with `SG.`)

### Issue: Emails going to spam
**Solution:**
- Verify your sender domain in SendGrid
- Add SPF and DKIM records (SendGrid provides instructions)

---

## 🎯 Next Steps

1. ✅ Get SendGrid API key (free account)
2. ✅ Update `.env` with API key
3. ✅ Test with `test-email-verification.js`
4. ✅ Deploy to Render with environment variables
5. ✅ Monitor email delivery in SendGrid dashboard

---

## 📚 Resources

- [SendGrid Documentation](https://docs.sendgrid.com/)
- [SendGrid API Reference](https://docs.sendgrid.com/api-reference/mail-send/mail-send)
- [Node.js SDK](https://github.com/sendgrid/sendgrid-nodejs)

---

## ✨ Benefits Over Gmail SMTP

| Benefit | Details |
|---------|---------|
| **Reliability** | No connection timeouts on cloud platforms |
| **Scalability** | Handle high volume reliably |
| **Deliverability** | Professional infrastructure for email delivery |
| **Analytics** | Track opens, clicks, bounces |
| **Support** | Dedicated support team |
| **Security** | API-based (no SMTP credentials exposed) |
