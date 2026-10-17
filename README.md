# Dynamic Pricing Website + Telegram Price Manager

A modern, production-ready dynamic pricing platform powered by **GitHub Pages**, **Cloudflare Workers**, **Cloudflare KV**, and a **Telegram Bot**.

Manage public service plans and pricing in real time by sending simple plain-text messages to a Telegram bot. The bot parses, validates, and updates the Cloudflare Worker API without requiring any GitHub commits, site rebuilds, or redeployments.

---

## 🌟 Key Features

- **Decoupled Architecture:** Static frontend hosted on GitHub Pages fetches prices dynamically from a serverless Cloudflare Worker API.
- **Instant Telegram Price Management:** Send plain-text price lists directly in Telegram with multi-format arrow, colon, dash, and equals support.
- **Persian & English Digit Support:** Native parsing of Persian (`۰-۹`) and English (`0-9`) digits, comma separators, and `K` / `هزار` multipliers.
- **Safety First:** Two-step confirmation flow with inline keyboard buttons, strict server-side validation, duplicate detection, and one-click rollback (`/undo`).
- **Modern Responsive UI:** Dark-mode by default, light-mode toggle, glassmorphism cards, skeleton loading states, offline banner detection, and accessible RTL/LTR layout.
- **Neutral Branding:** Uses generic, configurable terminology ("Special Plans", "Subscription Plans") without hardcoded service category labels.
- **Zero Ongoing Server Costs:** 100% serverless on Cloudflare's free tier and GitHub Pages.

---

## 🏗 Repository Structure

```text
/
├── index.html                   # Accessible, semantic static frontend
├── assets/
│   ├── css/
│   │   └── styles.css          # Modern responsive stylesheet (Dark/Light + RTL/LTR)
│   └── js/
│       ├── config.js           # Client configuration (API URL & branding)
│       └── app.js              # Client application (Fetch, skeletons, retry, i18n)
├── worker/
│   ├── src/
│   │   ├── index.ts            # Cloudflare Worker router & API endpoints
│   │   ├── parser.ts           # Plain-text price list parser
│   │   ├── validation.ts       # List validation and duplicate checks
│   │   ├── storage.ts          # Cloudflare KV storage layer & rollback logic
│   │   ├── auth.ts             # Timing-safe secret verification & admin allowlist
│   │   ├── telegram.ts         # Telegram webhook handler & bot interaction
│   │   └── types.ts            # TypeScript interfaces and definitions
│   ├── test/                   # Automated unit tests (Vitest)
│   ├── wrangler.toml           # Cloudflare Worker & KV configuration
│   ├── tsconfig.json           # TypeScript configuration
│   └── package.json            # Worker dependencies and scripts
├── .github/
│   └── workflows/
│       └── deploy-pages.yml    # CI: Automated tests + GitHub Pages deployment
├── .gitignore
├── LICENSE
└── README.md
```

---

## 🚀 Step-by-Step Setup and Deployment Guide

### 1. Create a Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/BotFather).
2. Send the `/newbot` command and follow the prompts to choose a display name and username (e.g. `MyPricingManagerBot`).
3. Save the **Bot API Token** (e.g. `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`).
4. (Optional) Set bot description and commands in BotFather:
   ```text
   prices - View currently published prices
   settitle - Change website page title
   undo - Rollback to previous version
   cancel - Cancel pending update
   help - Show formatting instructions
   ```

---

### 2. Obtain Your Telegram Numeric User ID

The bot restricts administrative actions to authorized numeric IDs (not usernames, preventing impersonation).

1. Message [@userinfobot](https://t.me/userinfobot) or [@raw_data_bot](https://t.me/raw_data_bot) on Telegram.
2. Note your numeric **Id** (e.g. `123456789`).
3. If you have multiple administrators, separate their numeric IDs with commas: `123456789,987654321`.

---

### 3. Setup Cloudflare Worker & Cloudflare KV

#### Prerequisites
- Node.js (v18+)
- Cloudflare account ([Sign up free](https://dash.cloudflare.com/sign-up))

#### Install Wrangler & Login
Open your terminal in the `worker/` directory:

```bash
cd worker
npm install
npx wrangler login
```

#### Create the Cloudflare KV Namespace

Run the following command to create a production KV namespace:

```bash
npx wrangler kv namespace create "PRICING_KV"
```

The output will display your namespace ID:

```toml
[[kv_namespaces]]
binding = "PRICING_KV"
id = "a1b2c3d4e5f6..."
```

Open `worker/wrangler.toml` and update the `id` field under `[[kv_namespaces]]`:

```toml
[[kv_namespaces]]
binding = "PRICING_KV"
id = "a1b2c3d4e5f6..." # Paste your actual KV namespace ID here
```

---

### 4. Configure Worker Secrets

Configure the required secrets using `wrangler secret put`. Run each command in `worker/`:

```bash
# 1. Telegram Bot Token from BotFather
npx wrangler secret put TELEGRAM_BOT_TOKEN

# 2. Telegram Webhook Secret (any random 32+ character alphanumeric string)
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET

# 3. Comma-separated list of authorized Telegram numeric user IDs
npx wrangler secret put ADMIN_TELEGRAM_IDS

# 4. Secret token for administrative REST API operations (random string)
npx wrangler secret put ADMIN_API_SECRET
```

> 💡 **Tip:** Generate random strings using `openssl rand -hex 24` or any password manager.

---

### 5. Deploy the Cloudflare Worker

Deploy your worker to Cloudflare's global edge network:

```bash
npm run deploy
```

Once deployment completes, Wrangler will output your live Worker URL, for example:
```text
https://pricing-worker.<your-account-subdomain>.workers.dev
```

Test that the worker is healthy:
```bash
curl https://pricing-worker.<your-account-subdomain>.workers.dev/api/health
```

Expected response:
```json
{"status":"ok","timestamp":"...","service":"dynamic-pricing-worker","version":"1.0.0"}
```

---

### 6. Register the Telegram Webhook

Point Telegram to your Worker's `/api/telegram/webhook` endpoint with your secret token:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://pricing-worker.<your-account-subdomain>.workers.dev/api/telegram/webhook",
    "secret_token": "<YOUR_TELEGRAM_WEBHOOK_SECRET>"
  }'
```

Expected response:
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

---

### 7. Configure the Frontend (GitHub Pages)

#### Option A: Direct Configuration in `assets/js/config.js`
Open `assets/js/config.js` and set your live Cloudflare Worker URL:

```javascript
window.__APP_CONFIG__ = {
  apiUrl: 'https://pricing-worker.<your-account-subdomain>.workers.dev',
  brandName: 'Subscription Portal',
  contactUrl: 'https://t.me/YourBotOrSupport',
  contactText: 'Support & Order',
  defaultLang: 'fa',
  cacheTtlMs: 60000,
  enableDemoModeOnFailure: false
};
```

#### Option B: Automated Configuration via GitHub Repository Variable
If you prefer not to commit your specific Worker URL to `assets/js/config.js`:
1. In your GitHub repository, go to **Settings** > **Secrets and variables** > **Actions** > **Variables** tab.
2. Click **New repository variable**.
3. Name: `WORKER_API_URL`
4. Value: `https://pricing-worker.<your-account-subdomain>.workers.dev`
5. The GitHub Actions workflow (`deploy-pages.yml`) will automatically inject it during static deployment!

---

### 8. Enable GitHub Pages Deployment

1. On GitHub, navigate to your repository: `https://github.com/ishantia/VPN-LOP`.
2. Go to **Settings** > **Pages**.
3. Under **Build and deployment** > **Source**, select **GitHub Actions**.
4. Every push to `main` will automatically:
   - Run unit tests and TypeScript type checks.
   - Deploy the static website to `https://ishantia.github.io/VPN-LOP/`.

---

## 📱 How to Update Prices via Telegram

### Standard Price List Format

Send a message in any of the following formats to your Telegram bot:

```text
Special Plans

10GB → 99K
20GB → 169K
30GB → 229K
50GB → 349K
100GB → 649K
```

### Supported Syntax Variations

The parser accepts flexible syntax styles:

| Format Example | Parsed Result |
|---|---|
| `10GB → 99K` | 10GB — 99,000 Tomans |
| `10 GB - 99K` | 10 GB — 99,000 Tomans |
| `10GB: 99000` | 10GB — 99,000 Tomans |
| `10GB = 99,000` | 10GB — 99,000 Tomans |
| `۱۰ گیگ -> ۹۹ هزار` | ۱۰ گیگ — 99,000 Tomans |
| `50GB => 349K` | 50GB — 349,000 Tomans |

### Confirmation and Publishing Flow

1. When you send a valid list, the bot generates a **formatted preview** and presents two inline buttons:
   - `[ ✅ تایید و انتشار در سایت ]`
   - `[ ❌ انصراف ]`
2. Click **تایید و انتشار** to publish. The Worker atomically updates Cloudflare KV and archives the previous version.
3. The public website updates on the next fetch or refresh.

### Bot Commands

| Command | Action |
|---|---|
| `/start` | Welcome message and quick overview |
| `/help` | Detailed guide on syntax and supported separators |
| `/prices` | Shows current published prices on the website |
| `/settitle <title>` | Changes the public page title without re-entering all plans |
| `/undo` | Restores previous version (instant rollback) |
| `/cancel` | Cancels any pending unconfirmed price update |

---

## 🔌 API Endpoints Reference

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/api/health` | No | Service health check |
| `GET` | `/api/prices` | No (CORS) | Retrieves latest published pricing data |
| `POST` | `/api/telegram/webhook` | Webhook Secret | Handles incoming Telegram updates |
| `POST` | `/api/admin/prices/preview` | `ADMIN_API_SECRET` | Validates and returns parsed preview |
| `POST` | `/api/admin/prices/publish` | `ADMIN_API_SECRET` | Directly publishes pricing data |
| `POST` | `/api/admin/prices/undo` | `ADMIN_API_SECRET` | Rolls back to previous version |

---

## 🧪 Testing and Quality Assurance

The backend includes a comprehensive test suite using **Vitest** covering:
- Digit normalization (Persian, Arabic, ASCII)
- Separator parsing (`→`, `->`, `=>`, `:`, `-`, `=`, `|`)
- Multiplier handling (`K`, `k`, `هزار`, commas, decimals)
- Duplicate plan detection
- Malformed line rejection with line number pointers
- Timing-safe secret verification
- Telegram user ID allowlisting
- KV publishing, rollback, and TTL expiration
- CORS and HTTP headers

### Running Tests Locally

```bash
cd worker
npm test
npm run typecheck
```

---

## 🛠 Troubleshooting

### 1. Telegram bot does not respond
- Verify webhook registration with:
  ```bash
  curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
  ```
  Ensure `url` points to your worker's `/api/telegram/webhook` and `has_custom_certificate` is false.
- Ensure your numeric user ID is included in `ADMIN_TELEGRAM_IDS`.

### 2. Website shows "Failed to Load Plans"
- Verify that `apiUrl` in `assets/js/config.js` matches your deployed Cloudflare Worker URL.
- Test the endpoint in your browser: `https://pricing-worker.<subdomain>.workers.dev/api/prices`.
- Ensure CORS origin in `worker/wrangler.toml` is set to `*` or your GitHub Pages domain (`https://ishantia.github.io`).

### 3. Accidental update published
- Send `/undo` in the Telegram bot to immediately restore the previous version.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
