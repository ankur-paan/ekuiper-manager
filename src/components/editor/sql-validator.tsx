"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JsonEditor } from "@/components/editor/json-editor";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Loader2,
  FileCode,
  Zap,
  Clock,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EKuiperManagerClient } from "@/lib/ekuiper/manager-client";
import type { SQLValidationResult, SQLTestResult } from "@/lib/ekuiper/manager-types";

interface SQLValidatorProps {
  sql: string;
  serverUrl?: string;
  onValidationChange?: (isValid: boolean) => void;
}

const DEFAULT_TEST_DATA = JSON.stringify(
  [
    {
      deviceId: "device_001",
      temperature: 25.5,
      humidity: 65,
      timestamp: new Date().toISOString(),
    },
    {
      deviceId: "device_002",
      temperature: 30.2,
      humidity: 55,
      timestamp: new Date().toISOString(),
    },
  ],
  null,
  2
);

export function SQLValidator({ sql, serverUrl, onValidationChange }: SQLValidatorProps) {
  const [validation, setValidation] = useState<SQLValidationResult | null>(null);
  const [testResult, setTestResult] = useState<SQLTestResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testData, setTestData] = useState(DEFAULT_TEST_DATA);
  const [client] = useState(() => new EKuiperManagerClient(serverUrl));

  // Auto-validate on SQL change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (sql.trim()) {
        handleValidate();
      } else {
        setValidation(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [sql]);

  // Report validation status
  useEffect(() => {
    onValidationChange?.(validation?.valid ?? true);
  }, [validation, onValidationChange]);

  const handleValidate = useCallback(async () => {
    if (!sql.trim()) return;

    setIsValidating(true);
    try {
      const result = await client.validateSQL(sql);
      setValidation(result);
    } catch (error) {
      setValidation({
        valid: false,
        error: error instanceof Error ? error.message : "Validation failed",
      });
    } finally {
      setIsValidating(false);
    }
  }, [sql, client]);

  const handleTest = useCallback(async () => {
    if (!sql.trim()) return;

    setIsTesting(true);
    try {
      const data = JSON.parse(testData);
      const result = await client.testRule(sql, data);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : "Test failed",
      });
    } finally {
      setIsTesting(false);
    }
  }, [sql, testData, client]);

  return (
    <Card className="border-dashed">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileCode className="h-4 w-4" />
          SQL Validation & Testing
          {validation && (
            <Badge variant={validation.valid ? "success" : "destructive"} className="ml-auto">
              {validation.valid ? (
                <>
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Valid
                </>
              ) : (
                <>
                  <XCircle className="h-3 w-3 mr-1" />
                  Invalid
                </>
              )}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <Tabs defaultValue="validate" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="validate" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Validate
            </TabsTrigger>
            <TabsTrigger value="test" className="gap-1">
              <Play className="h-3 w-3" />
              Test
            </TabsTrigger>
          </TabsList>

          <TabsContent value="validate" className="space-y-3 mt-3">
            <Button
              size="sm"
              onClick={handleValidate}
              disabled={isValidating || !sql.trim()}
              className="w-full"
            >
              {isValidating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Validate SQL
                </>
              )}
            </Button>

            {validation && (
              <div
                className={cn(
                  "rounded-lg border p-3 text-sm",
                  validation.valid
                    ? "bg-green-500/10 border-green-500/30"
                    : "bg-red-500/10 border-red-500/30"
                )}
              >
                {validation.valid ? (
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-700 dark:text-green-400">
                        SQL syntax is valid
                      </p>
                      {validation.warnings && validation.warnings.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {validation.warnings.map((warning, i) => (
                            <div key={i} className="flex items-start gap-1 text-yellow-600">
                              <AlertTriangle className="h-3 w-3 mt-0.5" />
                              <span className="text-xs">{warning}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-700 dark:text-red-400">
                        SQL syntax error
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        {validation.error}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="test" className="space-y-3 mt-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Test Data (JSON Array)
              </label>
              <JsonEditor
                value={testData}
                onChange={setTestData}
                height="100px"
              />
            </div>

            <Button
              size="sm"
              onClick={handleTest}
              disabled={isTesting || !sql.trim()}
              className="w-full"
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Run Test
                </>
              )}
            </Button>

            {testResult && (
              <div
                className={cn(
                  "rounded-lg border p-3 text-sm",
                  testResult.success
                    ? "bg-green-500/10 border-green-500/30"
                    : "bg-red-500/10 border-red-500/30"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="font-medium text-green-700 dark:text-green-400">
                          Test passed
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span className="font-medium text-red-700 dark:text-red-400">
                          Test failed
                        </span>
                      </>
                    )}
                  </div>
                  {testResult.executionTime && (
                    <Badge variant="secondary" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {testResult.executionTime}ms
                    </Badge>
                  )}
                </div>

                {testResult.error && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {testResult.error}
                  </p>
                )}

                {testResult.output && testResult.output.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground mb-1">Output:</p>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-32">
                      {JSON.stringify(testResult.output, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-3 w-3 mt-0.5" />
          <span>
            Validation checks syntax and semantic rules. Testing runs your query against sample data.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
