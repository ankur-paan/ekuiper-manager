# eKuiper Manager

[![Build Status](https://github.com/ankur-paan/ekuiper-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/ankur-paan/ekuiper-manager/actions/workflows/ci.yml)
[![License: IOSL](https://img.shields.io/badge/License-IDACS%20Open%20Source-green.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
[![Live Demo](https://img.shields.io/badge/Live-API%20Docs-orange)](https://ankur-paan.github.io/ekuiper-manager/)
[![AI Powered](https://img.shields.io/badge/AI-Powered-purple)](https://openrouter.ai)

> **🚀 The First Open-Source Web UI & Manager for [LF Edge eKuiper](https://ekuiper.org/) - Because the Community Deserves Better**

An open-source, community-driven web interface and management platform for eKuiper - the lightweight IoT data analytics and stream processing engine. Built because the existing closed-source solution is buggy and the community deserves a reliable, open alternative.

**Developed & Maintained by [I-Dacs Labs](https://i-dacs.com)**

📧 Contact: measure@i-dacs.com | 🌐 Website: [i-dacs.com](https://i-dacs.com) | 💼 [LinkedIn](https://www.linkedin.com/company/110770924)

---

## 🎯 Why This Project?

**There is currently no fully open-source eKuiper management UI.** EMQ's proprietary eKuiper Manager is:
- Closed source
- Reportedly buggy and unreliable
- Not community-extensible

This project aims to fill that gap with a **completely open-source, community-driven solution**.

---

## 📋 Feature Status

### ✅ Fully Built & Working

| Feature | Description |
|---------|-------------|
| **Swagger API Playground** | Complete interactive API documentation with live "Try It Out" functionality. Full OpenAPI 3.0 spec with 70+ endpoints. |
| **Rule Tracing & Debugging** | Real-time data flow tracing with span hierarchy and detailed message attributes. |
| **Rule Topology** | Visual graph representation of the data flow from sources through operators to sinks. |
| **Query Plan (Explain)** | Visualized execution plans and performance hints for eKuiper SQL queries. |
| **AI Assistant** | Conversational agent, Rule/Stream generators, Analysis tools. (New in v1.1.0) |
| **Server Persistence** | Browser-based (Default) or SQLite (Experimental) storage for server configs. |

### 🔶 Partially Built (Functional but Incomplete)

| Feature | Status | Notes |
|---------|--------|-------|
| **Rule Management** | 90% | List, start, stop, tracing, topology, and explain working. Edit with SQL working. Create with UI logic in progress. |
| **Dashboard Overview** | 70% | System info display, CPU/memory/uptime monitoring. Needs real-time refresh polish. |
| **Rule Metrics** | 70% | Basic metrics and status display. Advanced historical charts pending. |
| **eKuiper Health Check** | 80% | Ping and system info working. Connection status indicators need work. |
| **Action/Sink Configuration** | 40% | Basic MQTT sink working. Other sink types need implementation. |
| **Stream Management** | 50% | List and view streams. Create with SQL editor partially working. |

### 🚧 Under Development

| Feature | Priority | Notes |
|---------|----------|-------|
| Visual Pipeline Builder | Medium | Drag-and-drop rule builder with React Flow |
| Monaco SQL Editor | High | eKuiper SQL syntax highlighting & IntelliSense |
| MQTT Message Simulator | High | Test message generation for rule validation |
| Connection Management | Medium | Shared MQTT, Redis, SQL connections |
| Schema Registry | Low | Protobuf and JSON Schema management |
| Import/Export | Medium | Backup and restore configurations |
| Real-time Logs Viewer | Low | Filter and search server logs |
| Python Plugin Editor | Low | Custom function/source/sink development |
| Batch Rule Operations | Medium | Multi-select start/stop/delete |
| Configuration Templates | Low | Pre-configured source/sink templates |

---

## 🛣️ Development Roadmap

### Phase 1: MQTT-First Development (Current Priority)

**I have the capacity to fully test only MQTT-based pathways**, so those will be developed and validated first:

1. ✅ **Swagger API Playground** - Complete
2. 🔄 **MQTT Source Configuration** - In Progress
3. 🔄 **MQTT Sink Configuration** - In Progress
4. 🔄 **MQTT-based Rule Creation & Testing** - In Progress
5. ⏳ **MQTT Message Simulator** - Planned
6. ⏳ **MQTT Connection Management** - Planned

### Phase 2: Core Rule Engine Features

- ✅ Rule CRUD with validation (SQL-based)
- ✅ Rule status & basic metrics
- ✅ Rule topology visualization
- ✅ Data tracing and debugging
- ✅ Query execution plan visualization (Explain)
- ⏳ Advanced historical charts (Pending)

### Phase 3: Extended Sources & Sinks

- HTTP Pull/Push sources
- REST API sinks
- Redis pub/sub
- InfluxDB sinks
- File sources/sinks

### Phase 4: Advanced Features

- Schema registry integration
- Python plugin development environment
- Visual pipeline builder
- Import/Export functionality

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- eKuiper server running (default: http://localhost:9081)
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

### Persistence Configuration
By default, server connections are stored in your **Browser (Local Storage)**.
To enable **Database Mode (SQLite)** (Experimental/Beta):
1. Configure `prisma` in your environment.
2. Toggle "Persistence Mode" in **Settings**.
> **Note:** Database mode is work-in-progress and may be unstable. Browser mode is recommended.

### Connect to eKuiper

1. Start your eKuiper instance
2. Navigate to the Manager Overview
3. Enter your eKuiper server URL and click Connect
4. Explore the Swagger Playground at `/api-docs`

---

## 🤝 Contributing - Let's Build This Together!

**This project needs YOUR help to become the best eKuiper manager out there!**

### Why Contribute?

- 🌟 **First-mover advantage** - Be part of building the definitive open-source eKuiper UI
- 🔧 **Real impact** - Your code will be used by the global IoT community
- 📚 **Learn edge computing** - Work with cutting-edge IoT stream processing
- 🤝 **Community driven** - No corporate agenda, just building great software

### Priority Contribution Areas

| Area | Difficulty | Impact |
|------|------------|--------|
| **Non-MQTT Source Testing** | Medium | 🔥🔥🔥 I can't test these - need contributors with Kafka, Redis, HTTP setups |
| **Sink Type Implementation** | Medium | 🔥🔥🔥 InfluxDB, TDengine, SQL sinks need work |
| **UI/UX Improvements** | Easy-Medium | 🔥🔥 Always welcome |
| **Documentation** | Easy | 🔥🔥 Examples, tutorials, API guides |
| **Error Handling** | Medium | 🔥🔥 Edge cases and better user feedback |
| **Testing** | Medium | 🔥 Unit tests, integration tests |
| **Docker Support** | Medium | 🔥 Docker Compose setup with eKuiper |

### How to Contribute

1. **Fork the repository**
2. **Create your feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Guidelines

- Follow existing code style (TypeScript, React patterns)
- Add comments for complex logic
- Test with a running eKuiper instance
- Update documentation when adding features

---

## 🔌 Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 14** | React framework with App Router |
| **TypeScript** | Type-safe development |
| **Tailwind CSS** | Styling |
| **Radix UI** | Accessible UI primitives |
| **Monaco Editor** | Code editing |
| **React Flow** | Visual pipeline builder |
| **Swagger UI React** | API documentation |
| **Zustand** | State management |
| **OpenRouter** | AI Model Integration |

---

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Main application entry
│   └── api-docs/          # Swagger playground
├── components/
│   ├── dashboard/         # Metrics dashboard
│   ├── editor/            # Monaco code editors
│   ├── manager/           # Manager UI components
│   ├── pipeline/          # Visual pipeline builder
│   └── ui/                # Shared UI components
├── lib/
│   └── ekuiper/           # eKuiper API client
│       ├── client.ts          # Base REST client
│       ├── manager-client.ts  # Extended manager client
│       └── manager-types.ts   # TypeScript interfaces
└── public/
    └── ekuiper-openapi.json   # Complete OpenAPI spec
```

---

## 📄 License

This project is licensed under the **IDACS Open Source License (IOSL)** - see the [LICENSE](LICENSE) file for details.

**Key points:**
- ✅ Free to use, modify, and distribute
- ✅ Commercial use permitted
- 📧 Organizations with >$1M annual turnover using in production: please notify us at measure@i-dacs.com (just a friendly notification, no fee required)

---

## 🙏 Acknowledgments

- [LF Edge eKuiper](https://ekuiper.org/) - The IoT stream processing engine
- [EMQ](https://www.emqx.com/) - Original developers of eKuiper
- [Next.js](https://nextjs.org/) - React framework
- [Swagger UI](https://swagger.io/tools/swagger-ui/) - API documentation

---

## ⭐ Star This Repo!

If you find this project useful, please give it a star! It helps others discover the project and motivates continued development.

---

**Developed by [I-Dacs Labs](https://i-dacs.com)**

📧 measure@i-dacs.com | 🌐 [i-dacs.com](https://i-dacs.com) | 💼 [LinkedIn](https://www.linkedin.com/company/110770924)

*Building the future of Industrial IoT together.*
