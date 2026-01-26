
"use client";

import * as React from "react";
import { AppLayout } from "@/components/layout";
import { WizardLayout } from "@/components/wizard/wizard-layout";
import { useQueryWizardStore } from "@/stores/wizard-store";

import { Step1Source } from "@/components/wizard/steps/step1-source";
import { Step2Filter } from "@/components/wizard/steps/step2-filter";
import { Step3Transform } from "@/components/wizard/steps/step3-transform";
import { Step4Sink } from "@/components/wizard/steps/step4-sink";
import { Step5Test } from "@/components/wizard/steps/step5-test";
import { generateSqlFromWizard } from "@/lib/wizard/generator";
import { CodeEditor } from "@/components/ui/code-editor";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { useServerStore } from "@/stores/server-store";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function QueryDesignerPage() {
  const state = useQueryWizardStore();
  const { currentStep, ruleId } = state;
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find(s => s.id === activeServerId);
  const router = useRouter();

  // Ensure client is always configured for the active server
  // (Crucial if user refreshes on any step after the first)
  React.useEffect(() => {
    if (activeServer) {
      ekuiperClient.setBaseUrl(activeServer.url);
    }
  }, [activeServer]);

  const renderStep = () => {
    switch (currentStep) {
      case 0: return <Step1Source />;
      case 1: return <Step2Filter />;
      case 2: return <Step3Transform />;
      case 3: return <Step4Sink />;
      case 4: return <Step5Test />;
      default: return <div>Unknown Step</div>;
    }
  };

  const sql = React.useMemo(() => generateSqlFromWizard(state), [state]);

  const submitRule = async () => {
    if (!ruleId) {
      toast.error("Please provide a Rule ID in Step 4");
      return;
    }

    try {
      // Construct Actions
      // Construct Actions for Multi-Sink
      const actions = state.sinks.map(sink => {
        if (sink.targetType === 'mqtt') {
          return { mqtt: sink.properties };
        } else if (sink.targetType === 'rest') {
          return { rest: sink.properties };
        } else if (sink.targetType === 'log') {
          return { log: sink.properties };
        } else if (sink.targetType === 'nop') {
          return { log: {} }; // fall back to log for nop
        } else if (sink.targetType === 'memory') {
          return { memory: { topic: sink.properties.topic || "result" } };
        }
        return null;
      }).filter(Boolean); // Remove nulls

      const rulePayload = {
        id: ruleId,
        sql,
        actions: actions as any[]
      };

      // 1. Validate Rule first (Official eKuiper Best Practice)
      const validation = await ekuiperClient.validateRule(rulePayload);
      if (!validation.valid) {
        throw new Error(validation.error || "Rule validation failed");
      }

      // 2. Create Rule with Upsert Logic
      try {
        await ekuiperClient.createRule(rulePayload);
        toast.success(`Rule ${ruleId} created successfully!`);
      } catch (e: any) {
        const msg = e.message || "";
        // If rule exists (1000), try updating instead
        if (msg.includes("1000") || msg.toLowerCase().includes("already exist")) {
          const { id, ...updatePayload } = rulePayload;
          await ekuiperClient.updateRule(id, updatePayload);
          toast.success(`Rule ${ruleId} updated successfully (Upserted).`);
        } else {
          throw e; // Rethrow if it's a different error
        }
      }

      router.push("/rules"); // Redirect to rules list
    } catch (e: any) {
      console.error("Rule Operation Error:", e);
      let msg = e.message;

      // Handle cryptic codes from backend or proxy with remediation hints
      if (msg === "1000") msg = "Internal server error (1000). Usually means a configuration conflict or invalid plugin property.";
      if (msg === "422") msg = "Unprocessable Rule (422). The SQL query might refer to fields or streams that don't exist.";
      if (msg.includes("connection refused")) msg = "Could not reach eKuiper server. Please check your connection settings.";

      toast.error("Failed to deploy rule: " + msg, {
        duration: 5000,
      });
    }
  };

  return (
    <AppLayout title="Query Wizard">
      <div className="flex h-[calc(100vh-4rem)] w-full">
        <div className="flex-1 min-w-0">
          <WizardLayout onFinish={submitRule}>
            {renderStep()}
          </WizardLayout>
        </div>

        {/* SQL Preview Sidebar */}
        <div className="w-[350px] border-l bg-card flex flex-col">
          <div className="p-3 border-b flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted-foreground">SQL Preview</span>
          </div>
          <div className="flex-1 overflow-hidden relative">
            <div className="absolute inset-0">
              <CodeEditor value={sql} language="sql" readOnly />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
