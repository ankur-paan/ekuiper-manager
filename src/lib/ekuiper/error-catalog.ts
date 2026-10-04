/**
 * Edge Gateway & eKuiper Error Code Diagnostic Catalog
 * Maps upstream edge error strings and codes to human-readable explanations and troubleshooting actions.
 */

export interface EdgeDiagnostic {
  code: string;
  message: string;
  category: 'license' | 'template' | 'alert' | 'system' | 'auth' | 'request' | 'runtime';
  suggestion: string;
}

export const ERROR_DIAGNOSTICS: Record<string, EdgeDiagnostic> = {
  // License
  LICENSE_NOT_SUPPORT_EKUIPER: {
    code: 'LICENSE_NOT_SUPPORT_EKUIPER',
    message: 'The current edge license does not enable stream processing engine capabilities.',
    category: 'license',
    suggestion: 'Upgrade your license entitlement or disable stream processing modules in neuronex.yaml.',
  },
  LICENSE_EXPIRED: {
    code: 'LICENSE_EXPIRED',
    message: 'Edge license has expired.',
    category: 'license',
    suggestion: 'Renew or re-issue license from the edge management portal.',
  },
  LICENSE_TAG_INSUFFICIENT: {
    code: 'LICENSE_TAG_INSUFFICIENT',
    message: 'Allocated edge tag count exceeds license quota.',
    category: 'license',
    suggestion: 'Delete unused southbound tags or increase the tag count entitlement.',
  },
  HARDWARE_MISMATCH: {
    code: 'HARDWARE_MISMATCH',
    message: 'Hardware machine ID does not match license signature.',
    category: 'license',
    suggestion: 'Re-bind license key to the current host machine ID.',
  },

  // System & Edge Core
  REQUEST_EKUIPER_ERROR: {
    code: 'REQUEST_EKUIPER_ERROR',
    message: 'eKuiper stream processing engine returned an internal execution error.',
    category: 'system',
    suggestion: 'Inspect eKuiper server log for rule topology errors or failed connector sockets.',
  },
  REQUEST_NEURON_ERROR: {
    code: 'REQUEST_NEURON_ERROR',
    message: 'Neuron industrial data acquisition gateway error.',
    category: 'system',
    suggestion: 'Verify southbound driver connection status and check PLC physical link.',
  },
  NEURON_CODE_ERROR: {
    code: 'NEURON_CODE_ERROR',
    message: 'Neuron error code received.',
    category: 'system',
    suggestion: 'Refer to Neuron official API error code documentation at https://neugates.io/docs/en/latest/api/error-code.html.',
  },
  NEURON_NOT_READY: {
    code: 'NEURON_NOT_READY',
    message: 'Neuron gateway process is still initializing.',
    category: 'system',
    suggestion: 'Wait 5-10 seconds for IPC socket initialization and retry.',
  },
  SERVER_IS_BUSY: {
    code: 'SERVER_IS_BUSY',
    message: 'Edge node CPU or I/O is saturated.',
    category: 'system',
    suggestion: 'Throttle high-frequency stream sampling rates or increase concurrency buffers.',
  },

  // Template & Tags
  TAG_ADDRESS_FORMAT_INVALID: {
    code: 'TAG_ADDRESS_FORMAT_INVALID',
    message: 'Industrial tag register address format is invalid for this protocol driver.',
    category: 'template',
    suggestion: 'Check driver register prefix (e.g. 40001 for Modbus holding registers, DB1.DBW0 for S7).',
  },
  TAG_TYPE_NOT_SUPPORT: {
    code: 'TAG_TYPE_NOT_SUPPORT',
    message: 'Selected data type is not supported by this PLC driver.',
    category: 'template',
    suggestion: 'Verify data type compatibility (INT16, UINT16, FLOAT32, BIT, STRING) in driver documentation.',
  },
  LIBRARY_NOT_FOUND: {
    code: 'LIBRARY_NOT_FOUND',
    message: 'Driver shared library (.so) was not found in plugins path.',
    category: 'system',
    suggestion: 'Check if driver plugin is installed under /opt/neuron/plugins/.',
  },

  // Auth & Token
  INVALID_USERNAME_OR_PASSWORD: {
    code: 'INVALID_USERNAME_OR_PASSWORD',
    message: 'Invalid username or password credentials.',
    category: 'auth',
    suggestion: 'Verify admin account password or reset password via configuration console.',
  },
  MISSING_TOKEN: {
    code: 'MISSING_TOKEN',
    message: 'Missing JWT authorization token.',
    category: 'auth',
    suggestion: 'Provide Bearer token in Authorization header.',
  },
  WRONG_TOKEN: {
    code: 'WRONG_TOKEN',
    message: 'JWT authorization token is invalid or signature expired.',
    category: 'auth',
    suggestion: 'Log in again to obtain a fresh session token.',
  },

  // Request & Validation
  INVALID_PARAM: {
    code: 'INVALID_PARAM',
    message: 'Request parameter validation error.',
    category: 'request',
    suggestion: 'Inspect parameter field types and ensure required fields are not empty.',
  },
  JSON_FORMAT_ERROR: {
    code: 'JSON_FORMAT_ERROR',
    message: 'JSON payload is malformed.',
    category: 'request',
    suggestion: 'Validate JSON syntax and ensure string quoting is correct.',
  },
  REQUEST_TIME_OUT: {
    code: 'REQUEST_TIME_OUT',
    message: 'Edge node execution timed out waiting for upstream socket.',
    category: 'runtime',
    suggestion: 'Check network connectivity to remote brokers, databases, or PLCs.',
  },
};

/**
 * Translates an error code, message string, or status code into an actionable diagnostic.
 */
export function diagnoseError(rawError: string | number | undefined): EdgeDiagnostic | null {
  if (!rawError) return null;
  const str = String(rawError).trim();

  // Exact code match
  if (ERROR_DIAGNOSTICS[str]) {
    return ERROR_DIAGNOSTICS[str];
  }

  // Substring match
  for (const [code, diag] of Object.entries(ERROR_DIAGNOSTICS)) {
    if (str.toUpperCase().includes(code)) {
      return diag;
    }
  }

  return null;
}
