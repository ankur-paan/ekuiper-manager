#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "options", "trace"]);
const OFFICIAL_ROUTE_FILES = [
  "internal/server/rest.go",
  "internal/server/meta_init.go",
  "internal/server/plugin_init.go",
  "internal/server/portable_init.go",
  "internal/server/schema_init.go",
  "internal/server/service_init.go",
  "internal/server/script_init.go",
];

function fail(messages) {
  for (const message of messages) console.error(`ERROR: ${message}`);
  process.exit(1);
}

function normalizeOperation(method, routePath) {
  const normalizedPath = routePath.replace(/\{[^}]+\}/g, "{}");
  return `${method.toUpperCase()} ${normalizedPath}`;
}

function resolveJsonPointer(document, ref) {
  if (!ref.startsWith("#/")) return true;
  return ref
    .slice(2)
    .split("/")
    .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"))
    .reduce((value, part) => value?.[part], document);
}

function visit(value, visitor, location = "#") {
  visitor(value, location);
  if (Array.isArray(value)) {
    value.forEach((item, index) => visit(item, visitor, `${location}/${index}`));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      visit(child, visitor, `${location}/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`);
    }
  }
}

function validateDocument(spec) {
  const errors = [];
  const operationIds = new Map();
  const expectedSourcePrefix = "https://github.com/lf-edge/ekuiper/blob/v2.4.1/";

  if (!/^3\.0\./.test(spec.openapi ?? "")) {
    errors.push(`openapi must be a 3.0.x version, found ${JSON.stringify(spec.openapi)}`);
  }
  if (spec.info?.version !== "2.4.1") {
    errors.push(`info.version must be 2.4.1, found ${JSON.stringify(spec.info?.version)}`);
  }
  if (spec["x-ekuiper-version"] !== "2.4.1") {
    errors.push(`x-ekuiper-version must be 2.4.1, found ${JSON.stringify(spec["x-ekuiper-version"])}`);
  }
  if (spec["x-source-commit"] !== "bf8c1258b2a80e41e575d674346636c9bb687d33") {
    errors.push(`x-source-commit must pin the official v2.4.1 commit, found ${JSON.stringify(spec["x-source-commit"])}`);
  }

  for (const [routePath, pathItem] of Object.entries(spec.paths ?? {})) {
    if (!routePath.startsWith("/")) errors.push(`path does not start with '/': ${routePath}`);
    const templateNames = [...routePath.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);

    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (!HTTP_METHODS.has(method)) continue;
      const label = `${method.toUpperCase()} ${routePath}`;

      if (!operation.operationId) {
        errors.push(`${label} has no operationId`);
      } else if (operationIds.has(operation.operationId)) {
        errors.push(`${label} duplicates operationId '${operation.operationId}' from ${operationIds.get(operation.operationId)}`);
      } else {
        operationIds.set(operation.operationId, label);
      }

      if (!operation.responses || Object.keys(operation.responses).length === 0) {
        errors.push(`${label} has no responses`);
      }

      const sources = operation["x-ekuiper-source"];
      if (!Array.isArray(sources) || sources.length === 0) {
        errors.push(`${label} has no x-ekuiper-source provenance`);
      } else if (sources.some((source) => typeof source !== "string" || !source.startsWith(expectedSourcePrefix))) {
        errors.push(`${label} has a source outside the official tagged eKuiper tree`);
      }

      const parameters = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])].map((parameter) =>
        parameter?.$ref ? resolveJsonPointer(spec, parameter.$ref) : parameter,
      );
      const declaredPathParameters = parameters
        .filter((parameter) => parameter?.in === "path")
        .map((parameter) => parameter.name);
      for (const name of templateNames) {
        const parameter = parameters.find((candidate) => candidate?.in === "path" && candidate.name === name);
        if (!parameter) errors.push(`${label} does not declare path parameter '${name}'`);
        else if (parameter.required !== true) errors.push(`${label} path parameter '${name}' is not required`);
      }
      for (const name of declaredPathParameters) {
        if (!templateNames.includes(name)) errors.push(`${label} declares unused path parameter '${name}'`);
      }
    }
  }

  visit(spec, (value, location) => {
    if (value && typeof value === "object" && typeof value.$ref === "string") {
      if (value.$ref.startsWith("#/") && resolveJsonPointer(spec, value.$ref) === undefined) {
        errors.push(`${location} contains unresolved reference ${value.$ref}`);
      }
    }
  });

  const serialized = JSON.stringify(spec);
  if (serialized.includes("ankur-paan.github.io/ekuiper-manager")) {
    errors.push("the contract contains a forbidden loopback reference to its own GitHub Pages Swagger");
  }

  const operationCount = collectSpecOperations(spec).size;
  if (operationCount !== 140) errors.push(`the v2.4.1 contract must contain 140 operations, found ${operationCount}`);
  if (spec.paths?.["/plugins/{type}"]) errors.push("generic /plugins/{type} paths are not registered by eKuiper");

  const auth = spec.components?.securitySchemes?.JwtToken;
  if (auth?.type !== "apiKey" || auth?.in !== "header" || auth?.name !== "Authorization") {
    errors.push("JwtToken must model eKuiper's optional raw Authorization header as an apiKey security scheme");
  }

  const errorSchema = spec.components?.schemas?.ErrorResponse;
  const errorRequired = new Set(errorSchema?.required ?? []);
  if (
    errorSchema?.properties?.error?.type !== "integer" ||
    errorSchema?.properties?.message?.type !== "string" ||
    !errorRequired.has("error") ||
    !errorRequired.has("message")
  ) {
    errors.push("ErrorResponse must be the official {error: integer, message: string} envelope");
  }

  const tagMatch = spec.paths?.["/rules/tags/match"]?.get;
  if (!tagMatch?.requestBody?.content?.["application/json"] || tagMatch.requestBody.required !== true) {
    errors.push("GET /rules/tags/match must document its required application/json body");
  }

  const schemaUpload = spec.paths?.["/schemas/{type}/{name}/upload"]?.put;
  if (
    !schemaUpload?.requestBody?.content?.["multipart/form-data"] ||
    !schemaUpload?.responses?.["200"] ||
    !schemaUpload?.responses?.["201"] ||
    !schemaUpload?.responses?.["415"]
  ) {
    errors.push("schema upload must document multipart input plus 200, 201, and 415 responses");
  }

  if (!spec.paths?.["/rules/{name}/explain"]?.get?.responses?.["200"]?.content?.["text/plain"]) {
    errors.push("rule explain must be modeled as the tagged handler's text/plain plan output");
  }
  if (!spec.paths?.["/configs"]?.patch?.responses?.["204"]) {
    errors.push("PATCH /configs must document its empty 204 success response");
  }
  if (!spec.paths?.["/ruletest"]?.post?.responses?.["200"]?.content?.["text/plain"]) {
    errors.push("POST /ruletest must document the v2.4.1 text/plain wire media type");
  }
  if (!spec.paths?.["/connections"]?.get?.responses?.["200"]?.content?.["text/plain"]) {
    errors.push("GET /connections must document the v2.4.1 text/plain wire media type");
  }

  return errors;
}

function parseRegisteredRoutes(source) {
  const operations = new Set();
  const routePattern = /^(?!\s*\/\/)\s*r\.HandleFunc\("([^"]+)"[^\r\n]*?\)\.Methods\(([^)]*)\)/gm;
  for (const match of source.matchAll(routePattern)) {
    const routePath = match[1];
    for (const methodMatch of match[2].matchAll(/http\.Method([A-Za-z]+)/g)) {
      operations.add(normalizeOperation(methodMatch[1], routePath));
    }
  }
  return operations;
}

async function loadOfficialOperations(version, sourceDirectory) {
  const operations = new Set();
  for (const file of OFFICIAL_ROUTE_FILES) {
    let source;
    if (sourceDirectory) {
      source = await readFile(path.join(sourceDirectory, file), "utf8");
    } else {
      const url = `https://raw.githubusercontent.com/lf-edge/ekuiper/v${version}/${file}`;
      const response = await fetch(url, { headers: { "User-Agent": "ekuiper-manager-openapi-validator" } });
      if (!response.ok) throw new Error(`failed to fetch ${url}: ${response.status} ${response.statusText}`);
      source = await response.text();
    }
    for (const operation of parseRegisteredRoutes(source)) operations.add(operation);
  }
  return operations;
}

function collectSpecOperations(spec) {
  const operations = new Set();
  for (const [routePath, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const method of Object.keys(pathItem ?? {})) {
      if (HTTP_METHODS.has(method)) operations.add(normalizeOperation(method, routePath));
    }
  }
  return operations;
}

const args = process.argv.slice(2);
const specPath = path.resolve(args.find((arg) => !arg.startsWith("--")) ?? "public/ekuiper-openapi.json");
const sourceArg = args.find((arg) => arg.startsWith("--official-source-dir="));
const officialSourceDirectory = sourceArg ? path.resolve(sourceArg.slice("--official-source-dir=".length)) : undefined;
const skipOfficial = args.includes("--skip-official");

let spec;
try {
  spec = JSON.parse(await readFile(specPath, "utf8"));
} catch (error) {
  fail([`cannot parse ${specPath}: ${error.message}`]);
}

const documentErrors = validateDocument(spec);
if (documentErrors.length) fail(documentErrors);

if (!skipOfficial) {
  let officialOperations;
  try {
    officialOperations = await loadOfficialOperations(spec["x-ekuiper-version"], officialSourceDirectory);
  } catch (error) {
    fail([`cannot load official eKuiper route registrations: ${error.message}`]);
  }

  const specOperations = collectSpecOperations(spec);
  const missing = [...officialOperations].filter((operation) => !specOperations.has(operation)).sort();
  const extra = [...specOperations].filter((operation) => !officialOperations.has(operation)).sort();
  if (missing.length || extra.length) {
    const errors = [];
    if (missing.length) errors.push(`operations missing from the OpenAPI contract:\n  ${missing.join("\n  ")}`);
    if (extra.length) errors.push(`operations not registered by the tagged eKuiper management API:\n  ${extra.join("\n  ")}`);
    fail(errors);
  }

  console.log(`Validated ${specOperations.size} operations against eKuiper v${spec["x-ekuiper-version"]} registered routes.`);
} else {
  console.log(`Validated local OpenAPI structure for ${specPath}.`);
}
