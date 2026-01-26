
import { WizardState } from "@/lib/wizard/types";

/**
 * Robust SQL Generator that handles eKuiper technicalities (quoting, metadata, etc.)
 */
export function generateSqlFromWizard(state: WizardState): string {
    const { sources, joins, filters, aggregation, selections } = state;

    if (sources.length === 0) return "-- No Source Selected";

    // 1. SELECT (Enriched with Industrial Metadata for streams by default)
    const isStream = sources[0]?.resourceType === 'stream';
    const mainResource = sources[0];
    const schema = state.sourceSchemas[mainResource.resourceName];

    let selectClause = "SELECT *";

    // Automatic field enrichment for streams
    if (isStream) {
        selectClause = "SELECT *, meta(topic) AS topic, event_time() AS timestamp";
    }

    if (selections.length > 0) {
        selectClause = "SELECT " + selections.map(s => {
            if (!s.field) return null;

            let fieldPart = formatIdentifier(s.field);
            if (s.alias) {
                fieldPart += ` AS ${formatIdentifier(s.alias)}`;
            }
            return fieldPart;
        }).filter(Boolean).join(", ");
        if (selectClause === "SELECT ") selectClause = "SELECT *";
    } else if (schema && Object.keys(schema).length > 0) {
        // Poka-Yoke: If we have a schema but no selections, explicitly list fields
        // to avoid "SELECT *" issues in some downstream systems or for clarity.
        // However, we still append metadata for streams.
        const fields = Object.keys(schema).map(f => formatIdentifier(f)).join(", ");
        selectClause = `SELECT ${fields}`;
        if (isStream) {
            selectClause += ", meta(topic) AS topic, event_time() AS timestamp";
        }
    }

    // 2. FROM
    let fromClause = `FROM ${formatIdentifier(mainResource.resourceName)}`;
    if (mainResource.alias) fromClause += ` AS ${formatIdentifier(mainResource.alias)}`;

    // 3. JOIN
    const joinClauses = joins.map(j => {
        const targetSource = sources.find(s => s.id === j.targetSourceId);
        if (!targetSource) return "";

        let joinStr = `${j.joinType} JOIN ${formatIdentifier(targetSource.resourceName)}`;
        if (targetSource.alias) joinStr += ` AS ${formatIdentifier(targetSource.alias)}`;

        const onConditions = j.conditions.map(c => {
            if (!c.leftField || !c.rightField) return null;
            return `${formatIdentifier(c.leftField)} ${c.operator} ${formatIdentifier(c.rightField)}`;
        }).filter(Boolean).join(" AND ");

        if (onConditions) joinStr += ` ON ${onConditions}`;
        return joinStr;
    }).join(" ");

    // 4. WHERE
    let whereClause = "";
    if (filters.length > 0) {
        const groupSql = filters.map((group, idx) => {
            const exprs = group.expressions.map(e => {
                if (!e.field) return null;

                let field = formatIdentifier(e.field);
                let val = formatValue(e.value);

                // Handle Explicit Type Casting from UI
                if (e.castType === 'number') {
                    // Force field to float
                    if (field.includes("CAST(self")) {
                        field = `CAST(${field}, 'float')`;
                    } else {
                        field = `CAST(${field}, 'float')`;
                    }
                    // Ensure value is number
                    if (val.startsWith("'") || val.startsWith('"')) {
                        val = val.replace(/^['"]|['"]$/g, ''); // Unquote to make it a number literal
                    }
                } else if (e.castType === 'string') {
                    // Force field to string
                    if (!field.includes("CAST")) {
                        field = `CAST(${field}, 'string')`;
                    }
                    // Ensure value is quoted
                    if (!val.startsWith("'") && !val.startsWith('"')) {
                        val = `'${val}'`;
                    }
                }

                return `${field} ${e.operator} ${val}`;
            }).filter(Boolean).join(" AND ");

            if (!exprs) return null;
            const prefix = idx > 0 ? ` ${group.logic} ` : "";
            return `${prefix}(${exprs})`;
        }).filter(Boolean).join("");

        if (groupSql) {
            let processedGroupSql = groupSql;

            // Heuristic for 'Auto' mode (backwards compatibility)
            // Fix: Only apply if NO explicit cast was done? Or apply cleanly via regex.
            const numberPattern = /[0-9]+(?:\.[0-9]+)?/;

            // 1. CAST(self, 'string') op NUMBER
            processedGroupSql = processedGroupSql.replace(
                /(CAST\(self,\s*'string'\))\s*([<>!=]=?)\s*([0-9]+(?:\.[0-9]+)?)/g,
                "CAST($1, 'float') $2 $3"
            );

            // 2. NUMBER op CAST(self, 'string')
            processedGroupSql = processedGroupSql.replace(
                /([0-9]+(?:\.[0-9]+)?)\s*([<>!=]=?)\s*(CAST\(self,\s*'string'\))/g,
                "$1 $2 CAST($3, 'float')"
            );

            whereClause = `WHERE ${processedGroupSql}`;
        }
    }

    // 5. GROUP BY
    let groupClause = "";
    if (aggregation.enabled) {
        const groups: string[] = aggregation.groupByFields
            .filter(Boolean)
            .map(f => formatIdentifier(f));

        if (aggregation.windowType) {
            const winFunc = mapWindowType(aggregation.windowType);
            const winArgs = [];

            // Handle window arguments with defaults for non-tech users
            const unit = aggregation.windowUnit || 'ss';
            const length = aggregation.windowLength || '10';

            winArgs.push(unit);
            winArgs.push(length);

            if (aggregation.windowInterval) {
                winArgs.push(aggregation.windowInterval);
            }

            groups.push(`${winFunc}(${winArgs.join(", ")})`);
        }

        if (groups.length > 0) {
            groupClause = `GROUP BY ${groups.join(", ")}`;
        }
    }

    const output = [selectClause, fromClause, joinClauses, whereClause, groupClause]
        .filter(s => !!s.trim())
        .join("\n");

    return output.trim() + ";";
}

/**
 * Poka-Yoke: Mistake-proof field names.
 * - Handles meta(topic) automatically.
 * - Supports nested paths (data.temp) without backticking the dots.
 */
function formatIdentifier(id: string): string {
    if (!id) return "";
    const clean = id.trim();

    // Functional or special cases
    if (clean.includes("(") || clean === "*") return clean;

    // Special Case: payload refers to the raw message body (Poka-Yoke)
    // In 2.x, if stream is binary, we must CAST to string explicitly.
    if (clean.toLowerCase() === "payload") return "CAST(self, 'string')";

    // Split by dots to handle nested paths
    const parts = clean.split('.');
    const formattedParts = parts.map(part => {
        // If part starts/ends with backticks, it's already manual
        if (part.startsWith('`') && part.endsWith('`')) return part;

        // Wrap in backticks if it contains non-alpha or is a reserved-looking word
        if (/[^a-zA-Z0-9_]/.test(part) || part.toLowerCase() === 'timestamp' || part.toLowerCase() === 'topic') {
            return `\`${part}\``;
        }
        return part;
    });

    return formattedParts.join('.');
}

/**
 * Poka-Yoke: Mistake-proof values.
 * - Auto-quotes strings.
 * - Leaves numbers and booleans raw.
 */
function formatValue(val: any): string {
    if (val === undefined || val === null || val === "") return "''";

    const clean = String(val).trim();

    // Booleans
    if (clean === 'true' || clean === 'false') return clean;

    // Numbers (including those with decimals)
    if (!isNaN(Number(clean)) && clean !== "") return clean;

    // Already quoted
    if ((clean.startsWith("'") && clean.endsWith("'")) || (clean.startsWith('"') && clean.endsWith('"'))) {
        return clean;
    }

    // Must be a string literal
    return `'${clean}'`;
}

function mapWindowType(type: string) {
    switch (type) {
        case 'tumbling': return 'TumblingWindow';
        case 'hopping': return 'HoppingWindow';
        case 'sliding': return 'SlidingWindow';
        case 'session': return 'SessionWindow';
        case 'count': return 'CountWindow';
        default: return 'TumblingWindow';
    }
}
