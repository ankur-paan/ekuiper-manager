
import { generateSqlFromWizard } from "../generator";
import { WizardState } from "../types";

describe("SQL Generator", () => {
    const baseState: WizardState = {
        currentStep: 3,
        isStepValid: true,
        ruleId: "test-rule",
        sources: [
            { id: "s1", resourceName: "demo", resourceType: "stream", alias: "t1" }
        ],
        joins: [],
        filters: [],
        aggregation: { enabled: false, groupByFields: [] },
        selections: [],
        sinks: [{ id: "sink-1", targetType: "nop", properties: {} }],
        tourFocus: null,
        sourceSchemas: {},
        sharedConfigs: { mqtt: {} },
        testStatus: 'idle',
        testOutput: []
    };

    it("generates simple SELECT * for streams with metadata", () => {
        const sql = generateSqlFromWizard(baseState);
        expect(sql).toContain("SELECT *, meta(topic) AS topic, event_time() AS timestamp");
        expect(sql).toContain("FROM demo AS t1");
    });

    it("handles nested paths in filters", () => {
        const state: WizardState = {
            ...baseState,
            filters: [
                {
                    id: "f1",
                    logic: "AND",
                    expressions: [
                        { id: "e1", field: "payload.temp", operator: ">", value: "25" }
                    ]
                }
            ]
        };
        const sql = generateSqlFromWizard(state);
        expect(sql).toContain("WHERE (payload.temp > 25)");
    });

    it("maps 'payload' to 'CAST(self AS string)'", () => {
        const state: WizardState = {
            ...baseState,
            filters: [
                {
                    id: "f1",
                    logic: "AND",
                    expressions: [
                        { id: "e1", field: "payload", operator: "=", value: "ON" }
                    ]
                }
            ]
        };
        const sql = generateSqlFromWizard(state);
        expect(sql).toContain("WHERE (CAST(self, 'string') = 'ON')");
    });

    it("quotes reserved words or special chars in fields", () => {
        const state: WizardState = {
            ...baseState,
            selections: [
                { field: "my-field", alias: "val" },
                { field: "timestamp", alias: "ts" }
            ]
        };
        const sql = generateSqlFromWizard(state);
        expect(sql).toContain("SELECT `my-field` AS val, `timestamp` AS ts");
    });

    it("generates GROUP BY with window", () => {
        const state: WizardState = {
            ...baseState,
            aggregation: {
                enabled: true,
                windowType: "tumbling",
                windowUnit: "s",
                windowLength: 30,
                groupByFields: ["meta(topic)"]
            }
        };
        const sql = generateSqlFromWizard(state);
        expect(sql).toContain("GROUP BY meta(topic), TumblingWindow(s, 30)");
    });
});
