/**
 * eKuiper SQL Functions Catalog
 * Comprehensive list of all eKuiper SQL functions organized by category
 * 
 * Based on official eKuiper documentation from Context7
 * Used in Query Designer for function palette and autocomplete
 */

// =============================================================================
// Types
// =============================================================================

export interface EKuiperFunction {
    name: string;
    signature: string;
    description: string;
    examples?: string[];
    returnType?: string;
}

export interface FunctionCategory {
    id: string;
    name: string;
    icon: string;
    functions: EKuiperFunction[];
}

// =============================================================================
// Function Catalog - All 14 Categories
// =============================================================================

export const EKUIPER_FUNCTIONS: Record<string, EKuiperFunction[]> = {
    // 1. Aggregate Functions
    aggregate: [
        { name: 'avg', signature: 'avg(col)', description: 'Average of values', returnType: 'float' },
        { name: 'sum', signature: 'sum(col)', description: 'Sum of values', returnType: 'number' },
        { name: 'count', signature: 'count(*)', description: 'Count of rows', returnType: 'int' },
        { name: 'max', signature: 'max(col)', description: 'Maximum value', returnType: 'any' },
        { name: 'min', signature: 'min(col)', description: 'Minimum value', returnType: 'any' },
        { name: 'collect', signature: 'collect(col)', description: 'Collect values into array', returnType: 'array' },
        { name: 'merge_agg', signature: 'merge_agg(col)', description: 'Merge objects into one', returnType: 'object' },
        { name: 'deduplicate', signature: 'deduplicate(col, all)', description: 'Remove duplicate values', returnType: 'any' },
        { name: 'stddev', signature: 'stddev(col)', description: 'Standard deviation', returnType: 'float' },
        { name: 'stddevs', signature: 'stddevs(col)', description: 'Sample standard deviation', returnType: 'float' },
        { name: 'var', signature: 'var(col)', description: 'Variance', returnType: 'float' },
        { name: 'vars', signature: 'vars(col)', description: 'Sample variance', returnType: 'float' },
        { name: 'percentile', signature: 'percentile(col, percentile)', description: 'Calculate percentile of column in group', returnType: 'float' },
        { name: 'percentile_disc', signature: 'percentile_disc(col, percentile)', description: 'Calculate discrete percentile value', returnType: 'any' },
    ],

    // 2. Math Functions
    math: [
        { name: 'abs', signature: 'abs(col)', description: 'Absolute value', returnType: 'number' },
        { name: 'ceil', signature: 'ceil(col)', description: 'Round up to integer', returnType: 'int' },
        { name: 'floor', signature: 'floor(col)', description: 'Round down to integer', returnType: 'int' },
        { name: 'round', signature: 'round(col)', description: 'Round to nearest integer', returnType: 'int' },
        { name: 'sqrt', signature: 'sqrt(col)', description: 'Square root', returnType: 'float' },
        { name: 'power', signature: 'power(x, y)', description: 'x to the power of y', returnType: 'float' },
        { name: 'exp', signature: 'exp(col)', description: 'e raised to power', returnType: 'float' },
        { name: 'ln', signature: 'ln(col)', description: 'Natural logarithm', returnType: 'float' },
        { name: 'log', signature: 'log(col)', description: 'Base-10 logarithm', returnType: 'float' },
        { name: 'mod', signature: 'mod(x, y)', description: 'Modulo (remainder)', returnType: 'int' },
        { name: 'rand', signature: 'rand()', description: 'Random number 0-1', returnType: 'float' },
        { name: 'sign', signature: 'sign(col)', description: 'Sign of number (-1, 0, 1)', returnType: 'int' },
        { name: 'sin', signature: 'sin(col)', description: 'Sine', returnType: 'float' },
        { name: 'cos', signature: 'cos(col)', description: 'Cosine', returnType: 'float' },
        { name: 'tan', signature: 'tan(col)', description: 'Tangent', returnType: 'float' },
        { name: 'asin', signature: 'asin(col)', description: 'Arc sine', returnType: 'float' },
        { name: 'acos', signature: 'acos(col)', description: 'Arc cosine', returnType: 'float' },
        { name: 'atan', signature: 'atan(col)', description: 'Arc tangent', returnType: 'float' },
        { name: 'atan2', signature: 'atan2(y, x)', description: 'Two-argument arc tangent', returnType: 'float' },
        { name: 'bitand', signature: 'bitand(x, y)', description: 'Bitwise AND', returnType: 'int' },
        { name: 'bitor', signature: 'bitor(x, y)', description: 'Bitwise OR', returnType: 'int' },
        { name: 'bitxor', signature: 'bitxor(x, y)', description: 'Bitwise XOR', returnType: 'int' },
        { name: 'bitnot', signature: 'bitnot(x)', description: 'Bitwise NOT', returnType: 'int' },
        { name: 'cosh', signature: 'cosh(col)', description: 'Hyperbolic cosine', returnType: 'float' },
        { name: 'sinh', signature: 'sinh(col)', description: 'Hyperbolic sine', returnType: 'float' },
        { name: 'tanh', signature: 'tanh(col)', description: 'Hyperbolic tangent', returnType: 'float' },
    ],

    // 3. String Functions
    string: [
        { name: 'concat', signature: 'concat(a, b)', description: 'Concatenate strings', returnType: 'string' },
        { name: 'lower', signature: 'lower(col)', description: 'Convert to lowercase', returnType: 'string' },
        { name: 'upper', signature: 'upper(col)', description: 'Convert to uppercase', returnType: 'string' },
        { name: 'trim', signature: 'trim(col)', description: 'Trim whitespace', returnType: 'string' },
        { name: 'ltrim', signature: 'ltrim(col)', description: 'Trim left whitespace', returnType: 'string' },
        { name: 'rtrim', signature: 'rtrim(col)', description: 'Trim right whitespace', returnType: 'string' },
        { name: 'substring', signature: 'substring(col, start, len)', description: 'Extract substring', returnType: 'string' },
        { name: 'length', signature: 'length(col)', description: 'String length', returnType: 'int' },
        { name: 'indexof', signature: 'indexof(str, substr)', description: 'Find substring position', returnType: 'int' },
        { name: 'startswith', signature: 'startswith(str, prefix)', description: 'Check if starts with', returnType: 'bool' },
        { name: 'endswith', signature: 'endswith(str, suffix)', description: 'Check if ends with', returnType: 'bool' },
        { name: 'replace', signature: 'replace(str, old, new)', description: 'Replace substring', returnType: 'string' },
        { name: 'split', signature: 'split(str, delimiter)', description: 'Split into array', returnType: 'array' },
        { name: 'regexp_matches', signature: 'regexp_matches(str, pattern)', description: 'Regex match check', returnType: 'bool' },
        { name: 'regexp_replace', signature: 'regexp_replace(str, pattern, repl)', description: 'Regex replace', returnType: 'string' },
        { name: 'regexp_substr', signature: 'regexp_substr(str, pattern)', description: 'Regex extract', returnType: 'string' },
        { name: 'format', signature: 'format(template, args...)', description: 'Format string', returnType: 'string' },
        { name: 'lpad', signature: 'lpad(str, len, pad)', description: 'Left pad string', returnType: 'string' },
        { name: 'rpad', signature: 'rpad(str, len, pad)', description: 'Right pad string', returnType: 'string' },
        { name: 'numbytes', signature: 'numbytes(col)', description: 'Number of bytes in UTF-8 string', returnType: 'int' },
        { name: 'reverse', signature: 'reverse(col)', description: 'Reverse characters in string', returnType: 'string' },
        { name: 'split_value', signature: 'split_value(col, delimiter, index)', description: 'Split string and retrieve token at index', returnType: 'string' },
    ],

    // 4. Array Functions
    array: [
        { name: 'array_create', signature: 'array_create(a, b, c)', description: 'Create array from values', returnType: 'array' },
        { name: 'array_position', signature: 'array_position(arr, val)', description: 'Find element position', returnType: 'int' },
        { name: 'array_contains', signature: 'array_contains(arr, val)', description: 'Check if contains element', returnType: 'bool' },
        { name: 'array_length', signature: 'array_length(arr)', description: 'Array length', returnType: 'int' },
        { name: 'array_remove', signature: 'array_remove(arr, val)', description: 'Remove element', returnType: 'array' },
        { name: 'array_last', signature: 'array_last(arr)', description: 'Get last element', returnType: 'any' },
        { name: 'array_distinct', signature: 'array_distinct(arr)', description: 'Remove duplicates', returnType: 'array' },
        { name: 'array_map', signature: 'array_map(expr, arr)', description: 'Map function over array', returnType: 'array' },
        { name: 'array_max', signature: 'array_max(arr)', description: 'Maximum in array', returnType: 'any' },
        { name: 'array_min', signature: 'array_min(arr)', description: 'Minimum in array', returnType: 'any' },
        { name: 'array_concat', signature: 'array_concat(arr1, arr2)', description: 'Concatenate arrays', returnType: 'array' },
        { name: 'array_flatten', signature: 'array_flatten(arr)', description: 'Flatten nested arrays', returnType: 'array' },
        { name: 'array_shuffle', signature: 'array_shuffle(arr)', description: 'Randomly shuffle array', returnType: 'array' },
        { name: 'array_slice', signature: 'array_slice(arr, start, end)', description: 'Slice array', returnType: 'array' },
        { name: 'array_cardinality', signature: 'array_cardinality(arr)', description: 'Count elements', returnType: 'int' },
        { name: 'kvpair_array_to_obj', signature: 'kvpair_array_to_obj(arr)', description: 'Key-value pairs to object', returnType: 'object' },
    ],

    // 5. Object Functions
    object: [
        { name: 'keys', signature: 'keys(obj)', description: 'Get object keys', returnType: 'array' },
        { name: 'values', signature: 'values(obj)', description: 'Get object values', returnType: 'array' },
        { name: 'object', signature: 'object(keys, values)', description: 'Create object from arrays', returnType: 'object' },
        { name: 'object_concat', signature: 'object_concat(obj1, obj2)', description: 'Merge objects', returnType: 'object' },
        { name: 'object_construct', signature: 'object_construct(k1, v1, k2, v2)', description: 'Create from pairs', returnType: 'object' },
        { name: 'obj_to_kvpair_array', signature: 'obj_to_kvpair_array(obj)', description: 'Object to key-value pairs', returnType: 'array' },
        { name: 'zip', signature: 'zip(keys, values)', description: 'Zip arrays into object', returnType: 'object' },
        { name: 'items', signature: 'items(obj)', description: 'Get object key-value pairs', returnType: 'array' },
    ],

    // 6. Hashing Functions
    hashing: [
        { name: 'md5', signature: 'md5(col)', description: 'MD5 hash', returnType: 'string' },
        { name: 'sha1', signature: 'sha1(col)', description: 'SHA-1 hash', returnType: 'string' },
        { name: 'sha256', signature: 'sha256(col)', description: 'SHA-256 hash', returnType: 'string' },
        { name: 'sha384', signature: 'sha384(col)', description: 'SHA-384 hash', returnType: 'string' },
        { name: 'sha512', signature: 'sha512(col)', description: 'SHA-512 hash', returnType: 'string' },
    ],

    // 7. Transform Functions
    transform: [
        { name: 'cast', signature: 'cast(col, "type")', description: 'Type conversion', returnType: 'any' },
        { name: 'to_json', signature: 'to_json(col)', description: 'Convert to JSON string', returnType: 'string' },
        { name: 'parse_json', signature: 'parse_json(str)', description: 'Parse JSON string', returnType: 'any' },
        { name: 'convert_tz', signature: 'convert_tz(col, from, to)', description: 'Convert timezone', returnType: 'datetime' },
        { name: 'encode', signature: 'encode(col, "base64")', description: 'Encode (base64, hex)', returnType: 'string' },
        { name: 'decode', signature: 'decode(col, "base64")', description: 'Decode (base64, hex)', returnType: 'bytes' },
        { name: 'compress', signature: 'compress(col, "gzip")', description: 'Compress data', returnType: 'bytes' },
        { name: 'decompress', signature: 'decompress(col, "gzip")', description: 'Decompress data', returnType: 'bytes' },
        { name: 'trunc', signature: 'trunc(col, precision)', description: 'Truncate decimal places', returnType: 'float' },
        { name: 'chr', signature: 'chr(code)', description: 'Convert ASCII integer code to character', returnType: 'string' },
    ],

    // 8. JSON Functions
    json: [
        { name: 'json_path_query', signature: 'json_path_query(obj, path)', description: 'JSONPath query', returnType: 'any' },
        { name: 'json_path_query_first', signature: 'json_path_query_first(obj, path)', description: 'First JSONPath match', returnType: 'any' },
        { name: 'json_path_exists', signature: 'json_path_exists(obj, path)', description: 'Check JSONPath exists', returnType: 'bool' },
    ],

    // 9. Date and Time Functions
    datetime: [
        { name: 'now', signature: 'now()', description: 'Current timestamp (ms)', returnType: 'int' },
        { name: 'current_timestamp', signature: 'current_timestamp()', description: 'Current timestamp', returnType: 'datetime' },
        { name: 'format_time', signature: "format_time(col, 'YYYY-MM-dd HH:mm:ss')", description: 'Format datetime', returnType: 'string' },
        { name: 'date_calc', signature: 'date_calc(ts, duration)', description: 'Add/subtract duration', returnType: 'datetime' },
        { name: 'date_diff', signature: 'date_diff(ts1, ts2)', description: 'Difference between dates', returnType: 'int' },
        { name: 'year', signature: 'year(ts)', description: 'Extract year', returnType: 'int' },
        { name: 'month', signature: 'month(ts)', description: 'Extract month', returnType: 'int' },
        { name: 'day', signature: 'day(ts)', description: 'Extract day', returnType: 'int' },
        { name: 'hour', signature: 'hour(ts)', description: 'Extract hour', returnType: 'int' },
        { name: 'minute', signature: 'minute(ts)', description: 'Extract minute', returnType: 'int' },
        { name: 'second', signature: 'second(ts)', description: 'Extract second', returnType: 'int' },
        { name: 'weekday', signature: 'weekday(ts)', description: 'Day of week (0-6)', returnType: 'int' },
        { name: 'day_of_year', signature: 'day_of_year(ts)', description: 'Day of year (1-366)', returnType: 'int' },
    ],

    // 10. Other Functions
    other: [
        { name: 'isnull', signature: 'isnull(col)', description: 'Check if null', returnType: 'bool' },
        { name: 'coalesce', signature: 'coalesce(a, b, c)', description: 'First non-null value', returnType: 'any' },
        { name: 'nullif', signature: 'nullif(a, b)', description: 'Return null if equal', returnType: 'any' },
        { name: 'newuuid', signature: 'newuuid()', description: 'Generate UUID', returnType: 'string' },
        { name: 'tstamp', signature: 'tstamp()', description: 'Current timestamp', returnType: 'int' },
        { name: 'rule_id', signature: 'rule_id()', description: 'Current rule ID', returnType: 'string' },
        { name: 'mqtt', signature: 'mqtt(topic)', description: 'Get MQTT metadata', returnType: 'any' },
        { name: 'meta', signature: 'meta(key)', description: 'Get message metadata', returnType: 'any' },
        { name: 'cardinality', signature: 'cardinality(arr)', description: 'Array/map size', returnType: 'int' },
        { name: 'typeof', signature: 'typeof(col)', description: 'Get value type', returnType: 'string' },
    ],

    // 11. Analytic Functions
    analytic: [
        { name: 'changed_col', signature: 'changed_col(ignoreNull, col)', description: 'Detect value change', returnType: 'any' },
        { name: 'changed_cols', signature: 'changed_cols(prefix, ignoreNull, cols...)', description: 'Detect column changes', returnType: 'object' },
        { name: 'had_changed', signature: 'had_changed(ignoreNull, col)', description: 'Check if changed', returnType: 'bool' },
        { name: 'lag', signature: 'lag(col, offset, default)', description: 'Previous row value', returnType: 'any' },
        { name: 'latest', signature: 'latest(col, ignoreNull)', description: 'Latest non-null value', returnType: 'any' },
        { name: 'acc', signature: 'acc(col)', description: 'Accumulate values', returnType: 'any' },
        { name: 'delay', signature: 'delay(col, period)', description: 'Retrieve value delayed by specified period', returnType: 'any' },
    ],

    // 12. Multi-Row Functions
    multiRow: [
        { name: 'unnest', signature: 'unnest(arr)', description: 'Expand array to rows', returnType: 'any' },
        { name: 'extract', signature: 'extract(map)', description: 'Expand map to columns', returnType: 'any' },
    ],

    // 13. Multi-Column Functions
    multiColumn: [
        { name: 'changed_cols', signature: 'changed_cols(prefix, ignoreNull, cols...)', description: 'Output changed columns', returnType: 'object' },
        { name: 'row_to_json', signature: 'row_to_json()', description: 'Convert row to JSON', returnType: 'string' },
    ],

    // 14. Window Functions
    window: [
        { name: 'TumblingWindow', signature: 'TumblingWindow(ss, 10)', description: 'Fixed non-overlapping window', returnType: 'window' },
        { name: 'SlidingWindow', signature: 'SlidingWindow(ss, 10)', description: 'Overlapping sliding window', returnType: 'window' },
        { name: 'SessionWindow', signature: 'SessionWindow(ss, 10, 5)', description: 'Gap-based session window', returnType: 'window' },
        { name: 'CountWindow', signature: 'CountWindow(5)', description: 'Count-based window', returnType: 'window' },
        { name: 'DelayWindow', signature: 'DelayWindow(ss, 10)', description: 'Delayed trigger window', returnType: 'window' },
        { name: 'window_start', signature: 'window_start()', description: 'Window start timestamp (ms)', returnType: 'int' },
        { name: 'window_end', signature: 'window_end()', description: 'Window end timestamp (ms)', returnType: 'int' },
    ],

    // 15. Signal Processing & DSP (Edge Industrial Algorithms)
    signal_processing: [
        { name: 'datasmooth', signature: 'datasmooth(data, degree)', description: 'Polynomial fitting smoothing (Savitzky-Golay algorithm). Degree 0 (weak) to 4 (strong).', returnType: 'array', examples: ['datasmooth(vibration_data, 2)'] },
        { name: 'cleannormal', signature: 'cleannormal(data, regression_type)', description: 'Data normalization function for scaling signal series.', returnType: 'array', examples: ['cleannormal(sensor_signal, "linear")'] },
        { name: 'dimensionreduction', signature: 'dimensionreduction(array, compression_ratio, method)', description: 'Data dimensionality reduction and feature compression.', returnType: 'array', examples: ['dimensionreduction(features, 0.5, "pca")'] },
        { name: 'cleandrop', signature: 'cleandrop(data, compression_ratio)', description: 'Data downsampling and thinning for high-frequency streams.', returnType: 'array', examples: ['cleandrop(raw_stream, 0.25)'] },
        { name: 'cleansort', signature: 'cleansort(array, range, sort_type)', description: 'Sort function for windowed or grouped signal arrays.', returnType: 'array', examples: ['cleansort(telemetry, "all", "asc")'] },
        { name: 'peakvallydet', signature: 'peakvallydet(data, pthresh)', description: 'Peak and valley detection in signal series based on amplitude threshold.', returnType: 'object', examples: ['peakvallydet(waveform, 0.75)'] },
        { name: 'listmax', signature: 'listmax(data, param1)', description: 'Maximum value statistics over array or window sequence.', returnType: 'float', examples: ['listmax(pressure_batch, 1)'] },
        { name: 'listrms', signature: 'listrms(data, param1)', description: 'Root mean square (RMS) statistics for vibration and power calculations.', returnType: 'float', examples: ['listrms(vibration_z, 1)'] },
        { name: 'listamp', signature: 'listamp(data, param1)', description: 'Spoke value (peak-to-peak amplitude) statistics.', returnType: 'float', examples: ['listamp(amplitude_data, 1)'] },
        { name: 'butterworth', signature: 'butterworth(data, sample_rate, filter_band, type, order)', description: 'Butterworth IIR digital filter (lowpass, highpass, bandpass, bandstop).', returnType: 'array', examples: ['butterworth(accel_data, 1000, [10, 50], "bandpass", 4)'] },
        { name: 'chebyshev', signature: 'chebyshev(data, fs, ftype, freqs, order, rp)', description: 'Chebyshev Type I/II digital filter with passband ripple control.', returnType: 'array', examples: ['chebyshev(accel_data, 1000, "low", 50, 4, 0.5)'] },
        { name: 'fftamp', signature: 'fftamp(signal, sample_rate, type)', description: 'Fast Fourier Transform magnitude spectrum analysis.', returnType: 'array', examples: ['fftamp(vibration_waveform, 2048, "magnitude")'] },
        { name: 'fftpower', signature: 'fftpower(signal, sample_rate, unit, method, type)', description: 'Power Spectral Density (PSD) analysis using Welch or periodogram methods.', returnType: 'array', examples: ['fftpower(vibration_waveform, 2048, "dB", "welch", "power")'] },
    ],
};

// =============================================================================
// Function Categories Metadata
// =============================================================================

export const FUNCTION_CATEGORIES: FunctionCategory[] = [
    { id: 'aggregate', name: 'Aggregate', icon: '📊', functions: EKUIPER_FUNCTIONS.aggregate },
    { id: 'math', name: 'Math', icon: '🔢', functions: EKUIPER_FUNCTIONS.math },
    { id: 'signal_processing', name: 'Signal & DSP', icon: '📡', functions: EKUIPER_FUNCTIONS.signal_processing },
    { id: 'string', name: 'String', icon: '📝', functions: EKUIPER_FUNCTIONS.string },
    { id: 'array', name: 'Array', icon: '📋', functions: EKUIPER_FUNCTIONS.array },
    { id: 'object', name: 'Object', icon: '📦', functions: EKUIPER_FUNCTIONS.object },
    { id: 'hashing', name: 'Hashing', icon: '🔐', functions: EKUIPER_FUNCTIONS.hashing },
    { id: 'transform', name: 'Transform', icon: '🔄', functions: EKUIPER_FUNCTIONS.transform },
    { id: 'json', name: 'JSON', icon: '📄', functions: EKUIPER_FUNCTIONS.json },
    { id: 'datetime', name: 'DateTime', icon: '🕐', functions: EKUIPER_FUNCTIONS.datetime },
    { id: 'other', name: 'Other', icon: '⚡', functions: EKUIPER_FUNCTIONS.other },
    { id: 'analytic', name: 'Analytic', icon: '📈', functions: EKUIPER_FUNCTIONS.analytic },
    { id: 'multiRow', name: 'Multi-Row', icon: '↕️', functions: EKUIPER_FUNCTIONS.multiRow },
    { id: 'multiColumn', name: 'Multi-Column', icon: '↔️', functions: EKUIPER_FUNCTIONS.multiColumn },
    { id: 'window', name: 'Window', icon: '🪟', functions: EKUIPER_FUNCTIONS.window },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get all functions as a flat array
 */
export function getAllFunctions(): EKuiperFunction[] {
    return Object.values(EKUIPER_FUNCTIONS).flat();
}

/**
 * Search functions by name or description
 */
export function searchFunctions(query: string): EKuiperFunction[] {
    const lowerQuery = query.toLowerCase();
    return getAllFunctions().filter(
        (fn) =>
            fn.name.toLowerCase().includes(lowerQuery) ||
            fn.description.toLowerCase().includes(lowerQuery)
    );
}

/**
 * Get function by name
 */
export function getFunction(name: string): EKuiperFunction | undefined {
    return getAllFunctions().find(
        (fn) => fn.name.toLowerCase() === name.toLowerCase()
    );
}

/**
 * Get category for a function
 */
export function getFunctionCategory(name: string): string | undefined {
    for (const [category, functions] of Object.entries(EKUIPER_FUNCTIONS)) {
        if (functions.some((fn) => fn.name === name)) {
            return category;
        }
    }
    return undefined;
}
