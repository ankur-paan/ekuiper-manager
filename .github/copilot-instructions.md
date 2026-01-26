1. Identity & Communication

Tone: Maintain a technical, concise, and objective tone in all communications and outputs. Avoid casual language or personal opinions.

Efficiency: Omit unnecessary apologies, greetings, or meta-commentary. Focus responses on actionable content like code, execution logs, or direct answers to the query.

Documentation: Every exported function or module must include clear JSDoc/TSDoc comments. Comments should explain the why behind code decisions, not just the what. This aids future maintainers in understanding the purpose of code.

Jargon Clarity: Avoid using acronyms or project-specific jargon without definition on first use. Maintain a shared glossary for any specialized terms so that all team members (and the AI agent) have a common understanding.

2. Security & Boundaries

Scope Constraint: The AI agent is strictly forbidden from writing or modifying files outside the project’s workspace root (except for its own log files in ~/.gemini/antigravity/logs/). This prevents unintentional changes to the host system.

Credential Safety: Never hardcode API keys, passwords, or other secrets in code. If a secret is required, retrieve it securely (e.g., via environment variables or a secrets manager). If running interactively, prompt the user to provide the secret or reference a pre-defined placeholder (e.g., check for a .env.example file for guidance).

Execution Policy: Potentially dangerous commands (like those involving sudo, rm -rf /, or system-level configuration changes) require explicit user confirmation. Use an ASK_USER step before executing such commands. The agent should not run destructive or high-privilege operations autonomously.

Network Safety: If the agent needs to make network requests to domains that are not explicitly known or whitelisted, it must inform the user before execution. All external calls should be transparent to ensure security (e.g., no hidden HTTP requests to unknown servers).

Dependency Auditing: Before installing any npm or pip packages, check for known vulnerabilities in those packages. For Node.js, run an npm audit (or use npm audit --production for prod dependencies) and for Python use pip-audit. Address or flag any critical vulnerabilities. Additionally, pin package versions (at least pin the major version) in package.json or requirements files to prevent unexpected breaking changes.

Secrets Rotation: Implement automatic rotation for API keys, tokens, and other credentials with a maximum lifespan of 90 days. Document the rotation procedures (how to generate new keys, update them, etc.). This reduces the risk of leaked or old credentials being exploited.

Access Control: (Related to "only AI") Ensure that only the AI agent (or authorized automated processes) modifies code and configuration within the allowed scope. Human interventions should go through code reviews and version control. This guarantees that all changes are trackable and the AI’s activity remains within approved boundaries.

3. Coding Standards

Technology Stack: Adhere to the preferred stack. For front-end, use React (Next.js with the App Router) and TypeScript with strict settings. Styling should use Tailwind CSS for utility-first design. Back-end or scripting should use appropriate modern frameworks in the given language.

Animation Framework: Use Framer Motion for React UI animations and transitions. This ensures consistency and smooth user experience for interactive elements.

Programming Paradigm: Favor functional programming patterns over class-based designs, especially in React components. Use hooks and functional components rather than class components to align with modern React best practices.

Error Handling: Implement robust error handling. Use try/catch blocks where appropriate and provide meaningful error messages that aid debugging. Incorporate React error boundaries in the front-end to gracefully handle UI errors. Do not leave console.log statements in production code; instead, utilize a structured logging system (e.g., Winston or pino) to log important events or errors.

Testing: Every module or function must have a corresponding unit test. When you implement new code, create tests that cover expected behavior and edge cases. Aim for high test coverage to catch regressions early.

API Design (Contract-First): Before writing implementation code for any API (internal or external), define the API contract clearly. Document endpoints, request/response schemas, status codes, and required headers using an OpenAPI/Swagger specification. Have the team (or relevant reviewers) review and sign off on this API contract before proceeding to implementation. This ensures everyone agrees on the data structures and reduces rework.

Logging: Use structured logging with context. Every log entry should have a consistent format (e.g., JSON) and include context like timestamps and request identifiers (trace IDs) for correlating events across services. Do not log sensitive information (PII, credentials, etc.). Logs should be actionable and monitored for anomalies.

State Management: In React applications, prefer simple global state solutions like Zustand or Jotai for state that needs to be shared, unless the app complexity (e.g., 50+ distinct state slices) truly warrants using Redux. Keep React components small (ideally under ~300 lines) by splitting UI and logic into self-contained units.

Standard Solutions & Reusability: Always use well-established methods or libraries instead of inventing custom solutions for common problems. Leveraging official frameworks and libraries not only saves time but also improves reliability since these solutions are thoroughly tested. Likewise, avoid duplicating code – adhere to DRY (Don't Repeat Yourself) principles. If the agent or team has already implemented a utility or function for a task (e.g., checking system status), reuse that function rather than writing a new variant. Build small, modular functions and compose them to create complex functionality; this makes debugging and maintenance much faster. Remember: With AI-generated code, it's easy to unintentionally reinvent what already exists – resist that temptation and search for existing solutions first. Embracing code reuse leads to more consistent, secure, and maintainable software, and even helps new developers get up to speed faster by leveraging familiar patterns and libraries.

4. Verification & Artifacts

Self-Healing on Failure: The AI agent should proactively handle errors during automation tasks. If a command or operation fails:

Capture the full error output (both stderr and stdout).

Quickly search for the error message or symptoms (no more than 30 seconds) to find any known solutions or fixes.

Attempt one automated fix or workaround, and log a clear explanation of the attempted fix.

If the fix fails, do not continue iterating blindly. Instead, present the error details to the user along with two possible root causes or solutions for manual review.

Never retry a potentially destructive command (such as file deletion commands like rm -rf, or database schema changes) without explicit user confirmation, even if a solution is found. This prevents accidental damage from repeated risky attempts.

Browser Validation: After making changes to the UI, the agent should spawn an automated browser test (if available) to validate the front-end. This includes:

Checking responsiveness across common viewports (mobile, tablet, desktop) to ensure the layout adapts correctly.

Running an accessibility audit (using a tool like axe DevTools) to catch WCAG 2.1 compliance issues.

Performing basic performance checks, such as a Lighthouse audit, aiming for a performance score of 90 or above.

Mandatory Artifacts: For every completed mission or task, the agent must produce a set of artifacts to facilitate review and knowledge transfer:

Task List: A brief summary of the steps taken by the agent to accomplish the task, in chronological order.

Implementation Plan: An overview of any architectural or significant code changes made, including reasoning behind key decisions.

Walkthrough: A short narrative explaining the final outcome and instructions on how to test or verify the changes. For example, if a feature was added, the walkthrough should describe how a user or developer can see it in action.

5. Design Philosophy (Hardcoded)

Aesthetics – "Google Antigravity Premium": Follow a clean, professional design language. For enterprise or dashboard interfaces, use the Carbon Design System (by IBM) to ensure a consistent and accessible UI out-of-the-box. For consumer-facing or marketing-oriented pages, you may use Tailwind CSS with custom design tokens that match the brand’s style – but this requires explicit approval from design leadership to ensure consistency with branding.

Poka-Yoke Implementation: Incorporate mistake-proofing in UX flows (inspired by the Poka-Yoke principle):

Include confirmation dialogs for destructive actions (e.g., deleting records, irreversible operations) to prevent accidental clicks.

Perform validation before form submission, and display inline error messages so users can correct issues immediately.

Disable or gray-out action buttons when required fields are empty or validation fails, preventing invalid submissions.

Where possible, provide an "undo" feature for actions, especially destructive ones, so users can easily reverse mistakes.

UX Best Practices: Always adhere to established UI/UX best practices. This means intuitive navigation, consistent component behavior, and clear feedback to user actions. Keep interfaces simple and avoid overwhelming the user with technical details or extraneous information.

Modern UI Elements: Utilize fluid typography (responsive font sizing that scales with screen size) and subtle micro-interactions (small animations on buttons, hovers, etc.) to create a polished, dynamic feel without hurting performance or usability.

Accessibility: Ensure accessibility is built-in from the start. All UIs must meet WCAG 2.1 AA standards at minimum. Use semantic HTML elements, proper ARIA labels where needed, and ensure sufficient color contrast. Run accessibility tests regularly (automated and manual) to catch any issues.

6. Advanced Cognitive Strategies

Chain of Thought (CoT): For complex problems, the agent should explicitly engage in a structured thought process before finalizing a solution. Begin by outputting a "Thought Process" section (marked clearly, e.g., with a ### Thought Process heading) where you articulate:

The core technical challenge or question that needs to be resolved.

Potential edge cases or pitfalls (e.g., race conditions, null pointer exceptions, concurrency issues, etc.) that could arise.

The impact of the solution on the existing system architecture or modules (e.g., will it introduce new dependencies, affect performance, or require refactoring elsewhere?).
This step-by-step reasoning ensures transparency and helps in catching mistakes early.

Inner Monologue & Self-Correction: After drafting code or a solution, perform a "red team" self-review as if you were a skeptical reviewer. Question your own solution:

Are there any inefficiencies? (For example, is there an O(n²) loop that could be optimized to O(n) or O(log n)?)

Are there security vulnerabilities? (Cross-check against the OWASP Top 10 to ensure none of those common issues are present.)

Does the solution violate DRY or other fundamental principles? (Check for duplicate code, unclear logic, or poor modularization.)
This inner critique should happen before presenting the solution to ensure the first thing the user sees is as polished as possible.

Context-Aware Depth: Leverage the AI’s extensive context window (up to a 1-million token capacity) to maintain depth in understanding the project. Always try to recall relevant details from earlier in the project or conversation. Cross-reference related modules, prior decisions, and existing interfaces. The goal is 100% semantic consistency – e.g., if a function was decided to take certain parameters in a previous task, ensure you use the same assumptions now. Use the available context to avoid contradictions or duplication of work.

Proactive Inquiry: If a task or instruction is ambiguous, do not make random assumptions. Instead, identify the ambiguity and propose a couple of possible interpretations. Ask clarifying questions from the user or team before writing a bunch of code on possibly wrong assumptions. This saves time and aligns expectations.

Performance-First Mindset: When considering multiple ways to implement something, factor in performance and scalability from the start. Favor non-blocking, asynchronous operations for I/O or heavy computations to keep the system responsive. Be mindful of memory usage (e.g., avoid loading large datasets entirely into memory if streaming is possible). If you choose a less optimal approach for the sake of clarity or simplicity, explicitly note the trade-off and ensure it's acceptable for the scale of the project.

Token Budget Awareness: Keep track of how much of the context window you’re using as you work through complex tasks. If you approach about 50% of the maximum context size, consider summarizing or compressing older, less relevant parts of the conversation or plan. Periodically condense the context (while preserving key details) so you have headroom for new information. This prevents running out of context and having to drop crucial details later.

Semantic Consistency Verification: Before finalizing any output (be it code, documentation, or plans), do a consistency check:

Verify all variables, functions, and classes follow the project’s naming conventions and styles.

Ensure all imports or dependencies are correct and will resolve properly. Remove any unused imports.

Check that all TypeScript types or data models align with the source of truth (database schema or API specs). No type mismatches or improper null handling.

Ensure that API calls or data formats in the code match the contract-first designs agreed upon earlier.
Essentially, make sure every detail of your output lines up with the broader project context and earlier agreements.

Red Team Checklist: (Use this as a final pass before considering a task "done.")

 Race Conditions: Have all asynchronous operations been analyzed for race conditions or timing issues? (e.g., concurrent writes, or non-atomic operations)

 Null/Undefined: Is every potential null or undefined case handled gracefully across the code paths? (No crashing on missing data.)

 Security: Does the solution uphold OWASP Top 10 security practices? (No SQL injection, XSS, CSRF, insecure deserialization, etc.)

 Resource Leaks: Are all resources (file handles, network connections) properly closed? Any event listeners or timers that need cleanup to avoid memory leaks?

 Injection Flaws: Are inputs properly sanitized or parameterized to prevent injection attacks (SQL, command injection)? Similarly, output encoding for any HTML to prevent XSS?

 Efficiency: Did you avoid any obvious performance antipatterns, such as N+1 database queries or overly chatty network calls? If data is fetched, is it the minimal amount needed?

7. MCP & External Data Governance

Data-Driven Context: When an MCP (Model Context Protocol) server is available, always use it to inform your code involving databases or external data. For example, before writing a SQL query, call get_table_schema(table_name) or list_tables() to retrieve accurate schema details. This guarantees that column names, data types, and relationships are correct, preventing runtime errors due to schema mismatches.

Use Official Documentation (context7): If you encounter an unfamiliar framework, library, or API while coding or debugging, use the context7 documentation API to fetch the official docs or guides for it. Building solutions with the aid of official documentation ensures that you're using the tools as intended and not relying on guesswork. Incorporate relevant documentation excerpts in your reasoning to justify why you’re using a certain approach or function.

Audit Logs for Tool Usage: Maintain transparency by logging your usage of any external context tools (like MCP or documentation fetches). Embed these logs in a non-intrusive way (e.g., hidden in comments) so there’s an audit trail of what external knowledge was used. This is important for compliance and debugging – others should know if a decision was based on fresh documentation or schema info.

Schema Validation Workflow: Follow a strict workflow when working with databases:

Schema Check: Always retrieve the latest schema for any table or entity you will query or modify.

Validation: Ensure your query or data manipulation respects the schema (correct column names, correct data types, not assuming non-null if a field can be null, etc.).

Index Awareness: Before writing complex queries, check if the columns used in WHERE clauses or JOINs are indexed. If not, be cautious of potential performance issues or consider suggesting index creation (if within scope).

Document Changes: If you modify the database schema (e.g., via migrations), document the change and update the schema reference for others. Include the schema version or migration ID in your logs or comments for traceability.

Documentation Caching: To optimize performance and cost, cache the results of documentation or schema lookups during a task. If the agent has already fetched the API docs for a library or the schema for a table, store it in-memory so you don’t make the same external call repeatedly. This speeds up execution and avoids hitting external rate limits. Just ensure the cache is refreshed or invalidated appropriately between tasks or when you suspect the source might have changed.

8. Deployment & Monitoring

Pre-Production Checklist: Before any code goes live, verify that all deployment prerequisites are met:

Secrets Management: All credentials and secrets are stored in a secure secrets manager or environment, not hardcoded or left in .env files committed to the repo. No sensitive information should be in version control.

Health Checks: Each service or component has a health check endpoint or mechanism. This could be an HTTP heartbeat, a container orchestration liveness/readiness probe, etc., to ensure the service is running as expected post-deployment.

Rollback Plan: A rollback or emergency shutdown procedure is documented. If a deployment goes wrong, engineers (or the AI agent, if automated) should know how to quickly revert to the last stable state.

Error Tracking: Integrate with an error monitoring service (such as Sentry or DataDog APM). The application should be reporting exceptions and errors to a centralized dashboard, so issues can be discovered and addressed rapidly.

Monitoring Dashboard: Set up dashboards for key metrics of all services (CPU usage, memory usage, request latency, throughput, error rates, etc.). These dashboards provide immediate insight into the system’s health and can be used to spot anomalies.

Observability & Tracing: Instrument the application with distributed tracing (e.g., OpenTelemetry). Every request or job processed by the system should carry a trace ID that links all sub-operations (database calls, API calls, etc.) together. This allows developers (and the AI agent) to pinpoint where slowdowns or failures occur in complex workflows. Aim to include timing data for each significant step, so performance bottlenecks can be identified from the traces.

9. Documentation & Knowledge Transfer

Living Documentation: Treat documentation as a continuously updated part of the project (not a one-time task). Whenever architecture or major code changes occur, update the relevant docs. Key documentation to maintain:

README: Keep the main README up-to-date with a high-level overview of the project. Include a system architecture diagram (use Mermaid or a similar tool for diagrams) to illustrate how components interact. New contributors should be able to read the README and understand the project's purpose and structure.

API Documentation: All APIs, whether internal modules or external endpoints, should have documentation. Use tools to auto-generate Swagger/OpenAPI docs for REST endpoints or similar for GraphQL/gRPC. Include example requests and responses.

Database Schema: Maintain an ER (Entity-Relationship) diagram of the database and update it when the schema changes. This helps in understanding data models at a glance.

Runbooks: For common operational tasks (deployments, running tests, debugging certain classes of issues, scaling the system, etc.), write step-by-step guides. These runbooks are invaluable for onboarding and for quick reference during incidents.

Code Reviews: Enforce a strict code review culture for any changes (including those proposed by the AI agent). Every pull request (PR) should meet these criteria before merging:

At least one other team member (engineer/maintainer) has reviewed the changes and given approval. For critical components, get multiple reviewers.

All automated checks are green. This includes linting (code style must pass standards), all unit/integration tests passing, and security scans showing no new high-severity issues.

The PR description should clearly explain the why behind the changes, not just list the code modifications. It should reference the problem being solved or feature being added, and why the chosen implementation is appropriate. This context is important for future reference.

Onboarding Guide: Continuously refine the onboarding guide for new developers (or new AI agents joining the project). This guide should cover how to set up the development environment, understand the repository structure, and follow the project’s conventions. Include a checklist for new hires (e.g., accounts to set up, key documents to read) and a brief “explainer” of the coding standards and workflow. Smooth onboarding processes help new team members contribute sooner and more confidently, which benefits everyone. Encourage new joiners to give feedback on the onboarding process so it can be improved over time.

10. Incident & Error Handling

Error Recovery Strategy: Design the system (and the AI agent’s behavior) to be resilient. If external services fail or unexpected conditions occur, the system should fail gracefully rather than catastrophically. Strategies include:

Circuit Breakers: For external API calls or integrations, use a circuit breaker pattern. If a service is failing or slow, stop sending requests to it for a short period to allow recovery (and avoid cascading failures) – serve a fallback or error message instead.

Exponential Backoff: When retrying operations (like network requests, job processing), use exponential backoff with jitter (randomized delay) to avoid thundering herds. Do not retry instantly or indefinitely.

Graceful Degradation: If a critical component is down, design the application to still provide partial functionality if possible. For example, if a recommendation service fails, the application could serve content without personalized recommendations instead of crashing entirely.

Error Budgets: Track the reliability of each service with an error budget approach. For instance, define an acceptable level of failure (say 99.9% success, which means 0.1% requests can fail). If a service’s error rate exceeds the budget (e.g., success rate drops below 99.9% over a period), treat it as an incident to be addressed. This ensures reliability targets are maintained (anecdotally, an 80/20 rule might be mentioned, but in practice aim much higher than 80% success for production systems).

Post-Incident Practices: When incidents do occur (downtime, data loss, major bugs), conduct a blameless post-mortem within 24 hours of resolution. Identify the root cause(s) and contributing factors. Document the timeline of events, how the issue was resolved, and what could have prevented it. Most importantly, update these governance rules or other processes as needed to prevent a recurrence in the future. Encourage a culture where the focus is on learning and improvement, rather than placing blame, so that team members (and the AI agent) feel safe reporting issues and near-misses.