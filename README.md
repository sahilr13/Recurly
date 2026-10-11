<div align="center">

  <h1>💳 Recurrly</h1>
  <p><strong>Privacy-first subscription vault & bank statement financial intelligence for Android</strong></p>

  <p>
    <a href="#-key-features">Features</a> •
    <a href="#-tech-stack">Tech Stack</a> •
    <a href="#-architecture">Architecture</a> •
    <a href="#-getting-started">Getting Started</a> •
    <a href="#-standalone-apk-build">APK Build</a> •
    <a href="#-privacy--security">Security</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React Native" />
    <img src="https://img.shields.io/badge/Expo_SDK_54+-000020?style=for-the-badge&logo=expo&logoColor=white" alt="Expo" />
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Tailwind_NativeWind-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="NativeWind" />
    <img src="https://img.shields.io/badge/Clerk_Auth-6C47FF?style=for-the-badge&logo=clerk&logoColor=white" alt="Clerk" />
    <img src="https://img.shields.io/badge/Platform-Android_13+-3DDC84?style=for-the-badge&logo=android&logoColor=white" alt="Android" />
    <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License" />
  </p>

</div>

---

> **Zero Cloud Dependency:** Recurrly operates on an **on-device vault model**. Your bank statements, transaction histories, and recurring expenses are parsed locally inside your device sandbox and never transmitted to external servers.

---

## ⚡ Key Features

<table>
  <tr>
    <td width="50%">
      <h3>📄 Bank Statement Parser</h3>
      <p>Directly ingests SBI CSV and Excel (<code>.xlsx</code>) statements. A multi-line narrative stitcher handles wrapped UPI descriptions, irregular header rows, and shifted balance columns.</p>
    </td>
    <td width="50%">
      <h3>📊 FinHealth Scoring (0–100)</h3>
      <p>A deterministic financial assessment model evaluating real income retention, recurring commitment ratios (≤25% healthy, ≤40% moderate), daily burn rate, and liquid cash cushions.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>⏰ Scheduled Push Reminders</h3>
      <p>Native renewal alerts scheduled exactly 24 hours prior to billing deadlines using high-priority Android notification channels, preventing notification storms.</p>
    </td>
    <td width="50%">
      <h3>🛡️ Own-Account Deduplication</h3>
      <p>Intelligently filters out internal bank-to-bank and self-UPI transfers to prevent double-counting income or inflating expenses.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>💡 Annual Plan Optimizer</h3>
      <p>Scans recurring monthly services and projects potential savings against standard 16.7% annual plan discounts, excluding fixed bills and rent.</p>
    </td>
    <td width="50%">
      <h3>🌐 Multi-Currency Normalization</h3>
      <p>Handles cross-currency commitments with live normalization rates (₹96.4 / USD) alongside high-resolution dynamic icon fallbacks for major global and Indian services.</p>
    </td>
  </tr>
</table>

---

## 🛠 Tech Stack

| Domain | Technology | Description |
| :--- | :--- | :--- |
| **Runtime** | [React Native](https://reactnative.dev/) / [Expo](https://expo.dev/) | Cross-platform framework with file-based routing (`expo-router`) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | Strict static typing across domain models and stores |
| **UI & Styling** | [NativeWind](https://www.nativewind.dev/) (Tailwind CSS) | Utility-first mobile styling with custom design tokens |
| **State & Vault** | [Zustand](https://github.com/pmndrs/zustand) | Lightweight, reactive state synced with on-device persistence |
| **Authentication** | [Clerk](https://clerk.com/) | Authentication with session management and email OTP verification |
| **Analytics** | [PostHog React Native](https://posthog.com/) | Privacy-respecting product telemetry and usage metrics |
| **Data Engine** | [SheetJS (xlsx)](https://sheetjs.com/) | In-memory binary parsing for tabular statement files |
| **Dates & Times** | [Day.js](https://day.js.org/) | Fast date manipulation for rolling renewal countdowns |

---

## 📁 Architecture

```text
recurrly/
├── app/
│   ├── (auth)/                    # Clerk authentication flows
│   │   ├── sign-in.tsx            # Sign in with password, OTP verification & visibility toggle
│   │   └── sign-up.tsx            # Account registration with live validation
│   ├── (tabs)/                    # Tab navigation screens
│   │   ├── index.tsx              # Home: Total spend burn, renewal carousel & active feed
│   │   ├── subscriptions.tsx      # Subscriptions directory with search & status filters
│   │   ├── insights.tsx           # FinHealth score, cashflow dynamics & payee metrics
│   │   └── settings.tsx           # On-device vault controls, statement sync & alerts
│   └── _layout.tsx                # Global providers (Clerk, PostHog, Theme)
├── components/                    # Modular interface elements
│   ├── SubcriptionCard.tsx        # Accordion subscription card with edit/pause controls
│   ├── SubscriptionIcon.tsx       # Dynamic favicon and logo resolver
│   ├── UpcomingSubcriptionCard.tsx# Urgent renewal indicator badge card
│   ├── AnimatedPressable.tsx      # Spring-physics micro-interaction touchable
│   └── CreateSubscriptionModal.tsx# Subscription creation and cycle editor
├── lib/                           # Core business logic
│   ├── statementParser.ts         # Multi-line statement stitcher and CSV/XLSX parser
│   ├── analytics.ts               # FinHealth score computation & category aggregator
│   ├── subMath.ts                 # Currency conversion (₹96.4/$) and commitment math
│   ├── notifications.ts           # Native Android notification scheduling & permissions
│   └── subscriptionStore.ts       # Persistent Zustand state store
└── assets/                        # Custom typography (Plus Jakarta Sans) & adaptive icons
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- npm or yarn
- EAS CLI: `npm install -g eas-cli`
- Android 13+ device (for physical testing) or Android Emulator

### 1. Installation

```bash
# Clone the repository
git clone [https://github.com/your-username/subscription_manage_app.git](https://github.com/your-username/subscription_manage_app.git)
cd subscription_manage_app

# Install project dependencies
npm install
```

### 2. Environment Variables

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_key_here
```

### 3. Local Development

Start the Metro bundler:

```bash
npx expo start
```

- Press `a` to open in an Android Emulator.
- Press `i` to open in an iOS Simulator.
- Scan the terminal QR code using Expo Go.

---

## 📦 Standalone APK Build

Recurrly uses `expo-build-properties` configured for the modern 64-bit `arm64-v8a` architecture, reducing final APK size from **~124 MB down to ~30–38 MB** for physical device testing without Google Play requirements.

### 1. Configure Build Profile (`eas.json`)

Create an `eas.json` file in your root folder (keep this excluded from Git tracking):

```json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY": "pk_test_your_clerk_key_here"
      }
    }
  }
}
```

### 2. Trigger Cloud Build

```bash
eas build -p android --profile preview
```

When finished, download the `.apk` via the QR code printed in the terminal and install it on your device.

---

## 🔒 Privacy & Security

```text
[Bank Statement (CSV/XLSX)] ──> [Device Memory Sandbox] ──> [Local Zustand Vault]
                                            │
                                  (Never sent to cloud)
```

- **Client-Side Processing:** All statement reading, classification, and parsing logic execute in-memory on the phone.
- **No Third-Party Financial Aggregators:** Recurrly does not request online banking credentials or connect to open-banking scrape APIs.
- **Isolated Storage:** Subscription data and parsed transaction metadata remain locked inside the local app sandbox.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.