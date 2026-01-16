// eKuiper SQL Language Definition for Monaco Editor
// Includes all built-in functions, keywords, and type hints

export const EKUIPER_KEYWORDS = [
  // DDL Keywords
  "CREATE",
  "STREAM",
  "TABLE",
  "DROP",
  "DESCRIBE",
  "SHOW",
  "EXPLAIN",
  "WITH",

  // DML Keywords
  "SELECT",
  "FROM",
  "WHERE",
  "AS",
  "AND",
  "OR",
  "NOT",
  "IN",
  "BETWEEN",
  "LIKE",
  "IS",
  "NULL",
  "TRUE",
  "FALSE",

  // Aggregation
  "GROUP",
  "BY",
  "HAVING",
  "ORDER",
  "ASC",
  "DESC",
  "LIMIT",
  "OFFSET",

  // Joins
  "JOIN",
  "LEFT",
  "RIGHT",
  "FULL",
  "INNER",
  "OUTER",
  "CROSS",
  "ON",

  // Window functions
  "OVER",
  "PARTITION",
  "FILTER",

  // Case
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
];

export const EKUIPER_DATA_TYPES = [
  "BIGINT",
  "FLOAT",
  "STRING",
  "DATETIME",
  "BOOLEAN",
  "BYTEA",
  "ARRAY",
  "STRUCT",
];

export const EKUIPER_STREAM_OPTIONS = [
  "DATASOURCE",
  "FORMAT",
  "TYPE",
  "KEY",
  "CONF_KEY",
  "SHARED",
  "TIMESTAMP",
  "TIMESTAMP_FORMAT",
  "STRICT_VALIDATION",
];

export const EKUIPER_WINDOW_FUNCTIONS = [
  {
    name: "TUMBLINGWINDOW",
    signature: "TUMBLINGWINDOW(timeUnit, size)",
    description: "Fixed non-overlapping time windows. timeUnit: SS/MI/HH/DD, size: window size",
    example: "GROUP BY TUMBLINGWINDOW(ss, 10)",
  },
  {
    name: "HOPPINGWINDOW",
    signature: "HOPPINGWINDOW(timeUnit, size, hop)",
    description: "Overlapping time windows. hop: interval between windows",
    example: "GROUP BY HOPPINGWINDOW(mi, 5, 1)",
  },
  {
    name: "SLIDINGWINDOW",
    signature: "SLIDINGWINDOW(timeUnit, size)",
    description: "Sliding window that outputs on every event",
    example: "GROUP BY SLIDINGWINDOW(ss, 30)",
  },
  {
    name: "SESSIONWINDOW",
    signature: "SESSIONWINDOW(timeUnit, timeout, maxDuration)",
    description: "Activity-based windows with timeout",
    example: "GROUP BY SESSIONWINDOW(mi, 5, 30)",
  },
  {
    name: "COUNTWINDOW",
    signature: "COUNTWINDOW(count [, interval])",
    description: "Event count based windows",
    example: "GROUP BY COUNTWINDOW(100)",
  },
];

export const EKUIPER_AGGREGATE_FUNCTIONS = [
  {
    name: "avg",
    signature: "avg(col)",
    description: "Returns the average value of the column",
    returnType: "float",
  },
  {
    name: "count",
    signature: "count(*) | count(col)",
    description: "Returns the count of rows/non-null values",
    returnType: "bigint",
  },
  {
    name: "max",
    signature: "max(col)",
    description: "Returns the maximum value",
    returnType: "same as input",
  },
  {
    name: "min",
    signature: "min(col)",
    description: "Returns the minimum value",
    returnType: "same as input",
  },
  {
    name: "sum",
    signature: "sum(col)",
    description: "Returns the sum of values",
    returnType: "float",
  },
  {
    name: "collect",
    signature: "collect(*) | collect(col)",
    description: "Returns an array of all values in the group",
    returnType: "array",
  },
  {
    name: "deduplicate",
    signature: "deduplicate(col, returnAll)",
    description: "Removes duplicate values. returnAll: true returns all, false returns first",
    returnType: "same as input",
  },
];

export const EKUIPER_MATH_FUNCTIONS = [
  { name: "abs", signature: "abs(col)", description: "Absolute value" },
  { name: "ceil", signature: "ceil(col)", description: "Ceiling value" },
  { name: "floor", signature: "floor(col)", description: "Floor value" },
  { name: "round", signature: "round(col)", description: "Round to nearest integer" },
  { name: "sqrt", signature: "sqrt(col)", description: "Square root" },
  { name: "power", signature: "power(x, y)", description: "x raised to power y" },
  { name: "mod", signature: "mod(x, y)", description: "Modulo operation" },
  { name: "sin", signature: "sin(col)", description: "Sine" },
  { name: "cos", signature: "cos(col)", description: "Cosine" },
  { name: "tan", signature: "tan(col)", description: "Tangent" },
  { name: "asin", signature: "asin(col)", description: "Arc sine" },
  { name: "acos", signature: "acos(col)", description: "Arc cosine" },
  { name: "atan", signature: "atan(col)", description: "Arc tangent" },
  { name: "atan2", signature: "atan2(y, x)", description: "Arc tangent of y/x" },
  { name: "exp", signature: "exp(col)", description: "e raised to the power" },
  { name: "ln", signature: "ln(col)", description: "Natural logarithm" },
  { name: "log", signature: "log(col)", description: "Base 10 logarithm" },
  { name: "rand", signature: "rand()", description: "Random number 0-1" },
  { name: "sign", signature: "sign(col)", description: "Sign of number (-1, 0, 1)" },
  { name: "bitand", signature: "bitand(a, b)", description: "Bitwise AND" },
  { name: "bitor", signature: "bitor(a, b)", description: "Bitwise OR" },
  { name: "bitxor", signature: "bitxor(a, b)", description: "Bitwise XOR" },
  { name: "bitnot", signature: "bitnot(col)", description: "Bitwise NOT" },
];

export const EKUIPER_STRING_FUNCTIONS = [
  { name: "concat", signature: "concat(s1, s2, ...)", description: "Concatenate strings" },
  { name: "length", signature: "length(col)", description: "Length of string" },
  { name: "lower", signature: "lower(col)", description: "Convert to lowercase" },
  { name: "upper", signature: "upper(col)", description: "Convert to uppercase" },
  { name: "trim", signature: "trim(col)", description: "Remove leading/trailing whitespace" },
  { name: "ltrim", signature: "ltrim(col)", description: "Remove leading whitespace" },
  { name: "rtrim", signature: "rtrim(col)", description: "Remove trailing whitespace" },
  { name: "substring", signature: "substring(col, start [, length])", description: "Extract substring" },
  { name: "split_value", signature: "split_value(col, delimiter, index)", description: "Split and get value at index" },
  { name: "indexof", signature: "indexof(col, substr)", description: "Find position of substring" },
  { name: "startswith", signature: "startswith(col, prefix)", description: "Check if starts with prefix" },
  { name: "endswith", signature: "endswith(col, suffix)", description: "Check if ends with suffix" },
  { name: "regexp_matches", signature: "regexp_matches(col, pattern)", description: "Check regex match" },
  { name: "regexp_replace", signature: "regexp_replace(col, pattern, replacement)", description: "Replace regex matches" },
  { name: "regexp_substr", signature: "regexp_substr(col, pattern)", description: "Extract regex match" },
  { name: "lpad", signature: "lpad(col, len, pad)", description: "Left pad string" },
  { name: "rpad", signature: "rpad(col, len, pad)", description: "Right pad string" },
  { name: "format_time", signature: "format_time(col, format)", description: "Format datetime" },
];

export const EKUIPER_CONVERSION_FUNCTIONS = [
  { name: "cast", signature: "cast(col, \"type\")", description: "Cast to type: bigint, float, string, boolean, datetime" },
  { name: "chr", signature: "chr(col)", description: "Character from ASCII code" },
  { name: "encode", signature: "encode(col, encoding)", description: "Encode string (base64)" },
  { name: "trunc", signature: "trunc(col, decimals)", description: "Truncate to decimal places" },
];

export const EKUIPER_HASH_FUNCTIONS = [
  { name: "md5", signature: "md5(col)", description: "MD5 hash" },
  { name: "sha1", signature: "sha1(col)", description: "SHA1 hash" },
  { name: "sha256", signature: "sha256(col)", description: "SHA256 hash" },
  { name: "sha384", signature: "sha384(col)", description: "SHA384 hash" },
  { name: "sha512", signature: "sha512(col)", description: "SHA512 hash" },
];

export const EKUIPER_JSON_FUNCTIONS = [
  { name: "json_path_exists", signature: "json_path_exists(col, \"$.path\")", description: "Check if JSON path exists" },
  { name: "json_path_query", signature: "json_path_query(col, \"$.path\")", description: "Query JSON path, returns array" },
  { name: "json_path_query_first", signature: "json_path_query_first(col, \"$.path\")", description: "Query JSON path, returns first match" },
];

export const EKUIPER_OTHER_FUNCTIONS = [
  { name: "isNull", signature: "isNull(col)", description: "Check if value is null" },
  { name: "cardinality", signature: "cardinality(col)", description: "Length of array/map" },
  { name: "newuuid", signature: "newuuid()", description: "Generate UUID" },
  { name: "tstamp", signature: "tstamp()", description: "Current timestamp in ms" },
  { name: "mqtt", signature: "mqtt(key)", description: "Get MQTT metadata: topic, messageid, qos" },
  { name: "meta", signature: "meta(key) | meta(reading->key)", description: "Get metadata from source" },
  { name: "window_start", signature: "window_start()", description: "Window start timestamp" },
  { name: "window_end", signature: "window_end()", description: "Window end timestamp" },
  { name: "lag", signature: "lag(col [, offset])", description: "Get previous row value" },
  { name: "latest", signature: "latest(col)", description: "Get latest non-null value" },
  { name: "changed_col", signature: "changed_col(ignoreNull, col)", description: "Check if column changed" },
  { name: "had_changed", signature: "had_changed(ignoreNull, col1, col2...)", description: "Check if any column changed" },
];

// All functions combined for autocomplete
export const ALL_EKUIPER_FUNCTIONS = [
  ...EKUIPER_AGGREGATE_FUNCTIONS,
  ...EKUIPER_MATH_FUNCTIONS,
  ...EKUIPER_STRING_FUNCTIONS,
  ...EKUIPER_CONVERSION_FUNCTIONS,
  ...EKUIPER_HASH_FUNCTIONS,
  ...EKUIPER_JSON_FUNCTIONS,
  ...EKUIPER_OTHER_FUNCTIONS,
];

// SQL Templates for quick insertion
export const EKUIPER_SQL_TEMPLATES = {
  createStream: `CREATE STREAM stream_name (
  field1 BIGINT,
  field2 STRING,
  field3 FLOAT
) WITH (
  DATASOURCE = "topic/name",
  FORMAT = "JSON",
  TYPE = "mqtt"
);`,

  createSchemalessStream: `CREATE STREAM stream_name () WITH (
  DATASOURCE = "topic/name",
  FORMAT = "JSON",
  TYPE = "mqtt"
);`,

  createMemoryStream: `CREATE STREAM stream_name () WITH (
  DATASOURCE = "memory/topic",
  FORMAT = "JSON",
  TYPE = "memory"
);`,

  createTable: `CREATE TABLE table_name (
  id BIGINT,
  name STRING,
  value FLOAT
) WITH (
  DATASOURCE = "lookup.json",
  FORMAT = "JSON",
  TYPE = "file"
);`,

  selectBasic: `SELECT * FROM stream_name`,

  selectWithFilter: `SELECT field1, field2
FROM stream_name
WHERE field1 > 100 AND field2 IS NOT NULL`,

  selectWithWindow: `SELECT 
  avg(temperature) as avg_temp,
  max(temperature) as max_temp,
  min(temperature) as min_temp,
  count(*) as count
FROM sensor_stream
GROUP BY TUMBLINGWINDOW(ss, 10)`,

  selectWithJoin: `SELECT a.*, b.name
FROM stream_a AS a
LEFT JOIN table_b AS b
ON a.id = b.id
WHERE a.value > 50`,

  selectWithCase: `SELECT
  device_id,
  temperature,
  CASE
    WHEN temperature < 20 THEN 'cold'
    WHEN temperature < 30 THEN 'normal'
    ELSE 'hot'
  END AS status
FROM sensor_stream`,

  selectWithMeta: `SELECT 
  temperature,
  humidity,
  meta(deviceName) AS device,
  meta(origin) AS timestamp
FROM edgex_stream
WHERE meta(deviceName) = "sensor1"`,
};
