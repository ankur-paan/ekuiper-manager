# eKuiper Manager

[![Build Status](https://github.com/ankur-paan/ekuiper-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/ankur-paan/ekuiper-manager/actions/workflows/ci.yml)
[![License: IOSL](https://img.shields.io/badge/License-IDACS%20Open%20Source-green.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![AI Powered](https://img.shields.io/badge/AI-Powered-purple)](https://openrouter.ai)

> **🚀 The Smartest Open-Source Manager for [LF Edge eKuiper](https://ekuiper.org/)**

An open-source, community-driven web interface for eKuiper with **AI-powered assistance**, multi-server management, and advanced debugging tools. Built because the community deserves a modern, intelligent, and reliable management platform.

**Developed & Maintained by [I-Dacs Labs](https://i-dacs.com)**

---

## 🌟 New in v1.1.0: AI Assistant & Security

This release introduces a game-changing **AI Assistant** integrated throughout the application:

- 🤖 **Master Chat**: Conversational AI to help you manage rules, debug issues, and optimize streams.
- ⚡ **Generators**: Create complex Rules and Stream definitions from plain English descriptions.
- 🔍 **Deep Analysis**: Get performance insights, execution plan explanations, and log analysis.
- 🛡️ **Security Hardening**: Enterprise-grade security with SSRF protection options and resource limits.

---

## 📋 Key Features

| Feature | Description | Status |
|---------|-------------|--------|
| **AI Assistant** | Integrated chat, rule generation, stream generation, and log analysis. | ✅ Production |
| **Server Management** | Manage multiple eKuiper instances. Default **Browser Storage** with optional SQLite DB. | ✅ Production |
| **Swagger Playground** | Complete interactive API documentation with "Try It Out". | ✅ Production |
| **Rule Topology** | Visual graph of data flow (Source → Operators → Sink). | ✅ Production |
| **Tracing & Debugging** | Real-time trace spans, message attributes, and flow visualization. | ✅ Production |
| **Query Plan** | Visual `EXPLAIN` support to optimize SQL performance. | ✅ Production |
| **Stream Management** | Create, view, and import streams with schema inference. | ✅ Production |
| **Connection Manager** | Manage MQTT, HTTP, and SQL connections in one place. | 🔶 Beta |

---

## 💾 Persistence Options

eKuiper Manager supports two modes for storing your connection configurations:

### 1. 🌐 Browser Mode (Default)
Stores server connections and settings in your browser's **Local Storage**.
- **Pros**: Zero setup, data stays on your device, private.
- **Cons**: Configuration is not shared between browsers/devices.

### 2. 🗄️ Database Mode (Experimental)
Stores configuration in a local **SQLite** database via Prisma.
- **Pros**: Persistent across restarts, shared between users (if hosted).
- **Cons**: Requires `prisma generate` and setup.
- **Enable**: Go to **Settings > Persistence Mode** to toggle this feature.

> **Note**: Database mode is currently experimental. Browser mode is recommended for most users.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- eKuiper server running (default: `http://localhost:9081`)
- (Optional) OpenRouter API Key for AI features

### Installation

```bash
# Clone the repository
git clone https://github.com/ankur-paan/ekuiper-manager.git
cd ekuiper-manager

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### AI Configuration (Optional)
To enable AI features, create a `.env` file and add your OpenRouter key:
```env
OPENROUTER_API_KEY=your_key_here
```

---

## 🛡️ Security Configuration

For enterprise deployments, you can configure security restrictions via environment variables:

- `EKUIPER_ALLOWED_HOSTS`: Comma-separated list of allowed eKuiper hostnames (e.g., `ekuiper-prod,10.0.0.5`).
- `EKUIPER_ALLOW_PRIVATE_NETWORKS`: Set to `true` to allow connections to private IP ranges (default: `false`).

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Priority Areas
- **Sink Implementation**: InfluxDB, TDengine sinks needs UI forms.
- **Visual Builder**: Drag-and-drop rule builder (React Flow).
- **Testing**: End-to-end tests for non-MQTT sources.

---

## 📄 License

This project is licensed under the **IDACS Open Source License (IOSL)** - see the [LICENSE](LICENSE) file.

**Developed by [I-Dacs Labs](https://i-dacs.com)**
