"use client";

import Editor from "@monaco-editor/react";

interface PythonEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string | number;
  readOnly?: boolean;
}

export function PythonEditor({
  value,
  onChange,
  height = "400px",
  readOnly = false,
}: PythonEditorProps) {
  return (
    <div className="relative rounded-lg overflow-hidden border border-border">
      <Editor
        height={height}
        language="python"
        theme="vs-dark"
        value={value}
        onChange={(v) => onChange(v || "")}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
          lineNumbers: "on",
          folding: true,
          automaticLayout: true,
          scrollBeyondLastLine: false,
          wordWrap: "on",
          readOnly,
          tabSize: 4,
          renderLineHighlight: "all",
          padding: { top: 16, bottom: 16 },
        }}
      />
    </div>
  );
}

// Template for portable Python plugin
export const PYTHON_PLUGIN_TEMPLATE = `"""
SOTA eKuiper Portable Python Plugin
Custom function for streaming data processing
"""

from typing import Any, List
from ekuiper import Function, Context

class MyCustomFunction(Function):
    """
    Custom eKuiper function implementation.
    
    Usage in SQL: SELECT my_custom_function(field1, field2) FROM stream
    """
    
    def validate(self, args: List[Any]) -> str:
        """
        Validate the function arguments.
        Returns empty string if valid, error message otherwise.
        """
        if len(args) < 1:
            return "At least one argument required"
        return ""
    
    def exec(self, args: List[Any], ctx: Context) -> Any:
        """
        Execute the function with the given arguments.
        
        Args:
            args: List of argument values from SQL
            ctx: eKuiper context for logging and state
            
        Returns:
            The computed result
        """
        ctx.get_logger().info(f"Processing args: {args}")
        
        # Your custom logic here
        result = args[0]
        
        return result
    
    def is_aggregate(self) -> bool:
        """
        Return True if this is an aggregate function.
        Aggregate functions receive arrays of values for each argument.
        """
        return False


# Export the function
my_custom_function = MyCustomFunction()
`;

// Template for portable Python sink
export const PYTHON_SINK_TEMPLATE = `"""
SOTA eKuiper Portable Python Sink
Custom sink for sending processed data to external systems
"""

from typing import Any, Dict
from ekuiper import Sink, Context

class MyCustomSink(Sink):
    """
    Custom eKuiper sink implementation.
    
    Usage in rule actions:
    {
        "my_custom_sink": {
            "url": "http://localhost:8080",
            "api_key": "xxx"
        }
    }
    """
    
    def __init__(self):
        self.url = ""
        self.api_key = ""
        self.connected = False
    
    def configure(self, props: Dict[str, Any]) -> str:
        """
        Configure the sink with properties from rule definition.
        Returns empty string if valid, error message otherwise.
        """
        self.url = props.get("url", "")
        self.api_key = props.get("api_key", "")
        
        if not self.url:
            return "url is required"
        return ""
    
    def open(self, ctx: Context) -> str:
        """
        Open connection to the external system.
        Called once when the rule starts.
        """
        ctx.get_logger().info(f"Opening connection to {self.url}")
        self.connected = True
        return ""
    
    def collect(self, ctx: Context, data: Any) -> str:
        """
        Send data to the external system.
        Called for each message processed by the rule.
        
        Args:
            ctx: eKuiper context
            data: The processed data (dict or list)
            
        Returns:
            Empty string on success, error message on failure
        """
        ctx.get_logger().debug(f"Sending data: {data}")
        
        try:
            # Your custom send logic here
            # Example: requests.post(self.url, json=data, headers={"X-API-Key": self.api_key})
            pass
        except Exception as e:
            return str(e)
        
        return ""
    
    def close(self, ctx: Context) -> str:
        """
        Close connection to the external system.
        Called when the rule stops.
        """
        ctx.get_logger().info("Closing connection")
        self.connected = False
        return ""


# Export the sink
my_custom_sink = MyCustomSink()
`;

// Template for portable Python source
export const PYTHON_SOURCE_TEMPLATE = `"""
SOTA eKuiper Portable Python Source
Custom source for ingesting data from external systems
"""

from typing import Any, Dict, Generator
from ekuiper import Source, Context

class MyCustomSource(Source):
    """
    Custom eKuiper source implementation.
    
    Usage in stream definition:
    CREATE STREAM my_stream () WITH (
        TYPE = "my_custom_source",
        CONF_KEY = "default"
    )
    """
    
    def __init__(self):
        self.datasource = ""
        self.interval = 1000
        self.running = False
    
    def configure(self, datasource: str, props: Dict[str, Any]) -> str:
        """
        Configure the source with properties from configuration file.
        
        Args:
            datasource: The DATASOURCE value from stream definition
            props: Properties from configuration yaml
            
        Returns:
            Empty string if valid, error message otherwise
        """
        self.datasource = datasource
        self.interval = props.get("interval", 1000)
        return ""
    
    def open(self, ctx: Context) -> Generator[Dict[str, Any], None, None]:
        """
        Open the source and yield data tuples.
        This is a generator function that yields data continuously.
        
        Args:
            ctx: eKuiper context for logging and state
            
        Yields:
            Dict containing the data tuple
        """
        import time
        
        ctx.get_logger().info(f"Opening source: {self.datasource}")
        self.running = True
        
        while self.running:
            try:
                # Your custom data fetching logic here
                data = {
                    "timestamp": int(time.time() * 1000),
                    "value": 0,
                }
                
                yield data
                time.sleep(self.interval / 1000)
                
            except Exception as e:
                ctx.get_logger().error(f"Error: {e}")
                break
    
    def close(self, ctx: Context) -> str:
        """
        Close the source.
        Called when the stream is dropped or rule stops.
        """
        ctx.get_logger().info("Closing source")
        self.running = False
        return ""


# Export the source
my_custom_source = MyCustomSource()
`;
