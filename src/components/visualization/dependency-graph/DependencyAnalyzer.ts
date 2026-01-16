import { EKuiperClient } from "@/lib/ekuiper/client";

export type ResourceType = "stream" | "rule" | "table" | "plugin" | "sink";

export interface ResourceInfo {
  type: ResourceType;
  name: string;
  status?: string;
  metadata?: Record<string, any>;
}

export interface DependencyInfo {
  source: ResourceInfo;
  target: ResourceInfo;
  relationship: "reads_from" | "writes_to" | "joins" | "uses_plugin" | "uses_function";
}

export class DependencyAnalyzer {
  private client: EKuiperClient;

  constructor(connectionId: string) {
    this.client = new EKuiperClient(connectionId);
  }

  async analyze(): Promise<{
    resources: ResourceInfo[];
    dependencies: DependencyInfo[];
  }> {
    const resources: ResourceInfo[] = [];
    const dependencies: DependencyInfo[] = [];

    try {
      // Fetch all resources
      const [streams, rules, tables, plugins] = await Promise.all([
        this.client.listStreams().catch(() => []),
        this.client.listRules().catch(() => []),
        this.client.listTables().catch(() => []),
        this.fetchAllPlugins(),
      ]);

      // Add streams
      for (const stream of streams) {
        const name = typeof stream === "string" ? stream : stream.name;
        resources.push({
          type: "stream",
          name,
          status: "active",
        });
      }

      // Add tables
      for (const table of tables) {
        const name = typeof table === "string" ? table : table.name;
        resources.push({
          type: "table",
          name,
        });
      }

      // Add plugins
      for (const plugin of plugins) {
        resources.push({
          type: "plugin",
          name: plugin.name,
          metadata: { pluginType: plugin.type },
        });
      }

      // Analyze rules and their dependencies
      for (const rule of rules) {
        const ruleInfo = typeof rule === "string" 
          ? await this.client.getRule(rule).catch(() => null)
          : rule;

        if (!ruleInfo) continue;

        const ruleName = ruleInfo.id;
        const ruleSql = "sql" in ruleInfo ? ruleInfo.sql : undefined;
        resources.push({
          type: "rule",
          name: ruleName,
          status: "status" in ruleInfo ? ruleInfo.status : "unknown",
          metadata: { sql: ruleSql },
        });

        // Parse SQL for dependencies
        if (ruleSql) {
          const sqlDeps = this.parseSqlDependencies(ruleSql);

          // Stream/Table dependencies
          for (const dep of sqlDeps.sources) {
            const sourceResource = resources.find(
              (r) => (r.type === "stream" || r.type === "table") && r.name === dep
            );
            if (sourceResource) {
              dependencies.push({
                source: sourceResource,
                target: { type: "rule", name: ruleName },
                relationship: "reads_from",
              });
            }
          }

          // Join dependencies
          for (const join of sqlDeps.joins) {
            const joinResource = resources.find(
              (r) => (r.type === "stream" || r.type === "table") && r.name === join
            );
            if (joinResource) {
              dependencies.push({
                source: joinResource,
                target: { type: "rule", name: ruleName },
                relationship: "joins",
              });
            }
          }

          // Function/Plugin dependencies
          for (const func of sqlDeps.functions) {
            const pluginResource = resources.find(
              (r) => r.type === "plugin" && r.name === func
            );
            if (pluginResource) {
              dependencies.push({
                source: pluginResource,
                target: { type: "rule", name: ruleName },
                relationship: "uses_function",
              });
            }
          }
        }

        // Action/Sink dependencies
        const ruleActions = "actions" in ruleInfo ? ruleInfo.actions : undefined;
        if (ruleActions) {
          for (const action of ruleActions) {
            const sinkType = Object.keys(action)[0];
            const sinkConfig = action[sinkType];

            const sinkName = `${ruleName}-${sinkType}`;
            resources.push({
              type: "sink",
              name: sinkName,
              metadata: { sinkType, config: sinkConfig },
            });

            dependencies.push({
              source: { type: "rule", name: ruleName },
              target: { type: "sink", name: sinkName },
              relationship: "writes_to",
            });
          }
        }
      }
    } catch (error) {
      console.error("Failed to analyze dependencies:", error);
    }

    return { resources, dependencies };
  }

  private async fetchAllPlugins(): Promise<{ name: string; type: string }[]> {
    const plugins: { name: string; type: string }[] = [];

    try {
      const [sources, sinks, functions] = await Promise.all([
        this.client.listPlugins("sources").catch(() => []),
        this.client.listPlugins("sinks").catch(() => []),
        this.client.listPlugins("functions").catch(() => []),
      ]);

      for (const name of sources) {
        plugins.push({ name, type: "source" });
      }
      for (const name of sinks) {
        plugins.push({ name, type: "sink" });
      }
      for (const name of functions) {
        plugins.push({ name, type: "function" });
      }
    } catch (error) {
      console.error("Failed to fetch plugins:", error);
    }

    return plugins;
  }

  private parseSqlDependencies(sql: string): {
    sources: string[];
    joins: string[];
    functions: string[];
  } {
    const sources: string[] = [];
    const joins: string[] = [];
    const functions: string[] = [];

    // Simple regex-based parsing
    // In production, use a proper SQL parser

    // FROM clause
    const fromMatch = sql.match(/FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
    if (fromMatch) {
      sources.push(fromMatch[1]);
    }

    // JOIN clauses
    const joinRegex = /JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
    let joinMatch;
    while ((joinMatch = joinRegex.exec(sql)) !== null) {
      joins.push(joinMatch[1]);
    }

    // Function calls (simplified)
    const funcRegex = /([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
    let funcMatch;
    const builtinFunctions = new Set([
      "SELECT", "FROM", "WHERE", "GROUP", "ORDER", "HAVING",
      "SUM", "AVG", "COUNT", "MAX", "MIN", "CASE", "WHEN",
    ]);
    while ((funcMatch = funcRegex.exec(sql)) !== null) {
      const funcName = funcMatch[1].toUpperCase();
      if (!builtinFunctions.has(funcName)) {
        functions.push(funcMatch[1].toLowerCase());
      }
    }

    return { sources, joins, functions };
  }
}
