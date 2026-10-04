/**
 * Built-in eKuiper operator schemas (from LF Edge etc/ops metadata).
 * These define operator node properties, inputs, outputs, and validation rules
 * for the visual flow canvas and rule topology editors.
 */

export interface OperatorNodeSchema {
  name: string;
  about: {
    trial?: boolean;
    author?: {
      name?: string;
      email?: string;
      company?: string;
      website?: string;
    };
    helpUrl?: {
      en_US?: string;
      zh_CN?: string;
    };
    description?: {
      en_US?: string;
      zh_CN?: string;
    };
  };
  properties: Array<{
    name: string;
    optional?: boolean;
    control?: string;
    type?: string;
    default?: unknown;
    values?: unknown[];
    hint?: {
      en_US?: string;
      zh_CN?: string;
    };
    label?: {
      en_US?: string;
      zh_CN?: string;
    };
    properties?: any[];
  }>;
  node: {
    display?: boolean;
    category?: string;
    input?: {
      type?: string;
      rowType?: string;
      collectionType?: string;
      allowMulti?: boolean;
      [key: string]: unknown;
    };
    output?: {
      type?: string;
      strategy?: string;
      [key: string]: unknown;
    };
    icon?: string;
    label?: {
      en?: string;
      zh?: string;
    };
  };
}

export const BUILTIN_OPERATORS: Record<string, OperatorNodeSchema> = {
  "filter": {
    "name": "filter",
    "about": {
      "trial": false,
      "author": {
        "name": "EMQ",
        "email": "contact@emqx.io",
        "company": "EMQ Technologies Co., Ltd",
        "website": "https://www.emqx.io"
      },
      "helpUrl": {
        "en_US": "https://github.com/lf-edge/ekuiper/blob/master/docs/en_US/sqls/query_language_elements.md",
        "zh_CN": "https://github.com/lf-edge/ekuiper/blob/master/docs/zh_CN/sqls/query_language_elements.md"
      },
      "description": {
        "en_US": "An operation to filter out rows based on a filter condition.",
        "zh_CN": "用于过滤数据流的操作"
      }
    },
    "properties": [
      {
        "name": "expr",
        "optional": false,
        "control": "text",
        "type": "string",
        "hint": {
          "en_US": "filter condition expression",
          "zh_CN": "过滤条件语句"
        },
        "label": {
          "en_US": "Condition",
          "zh_CN": "条件"
        }
      }
    ],
    "node": {
      "display": true,
      "category": "operator",
      "input": {
        "type": "any",
        "rowType": "any",
        "collectionType": "any"
      },
      "output": {
        "type": "same",
        "strategy": "keep"
      },
      "icon": "iconPath",
      "label": {
        "en": "Filter",
        "zh": "过滤"
      }
    }
  },
  "function": {
    "name": "function",
    "about": {
      "trial": false,
      "author": {
        "name": "EMQ",
        "email": "contact@emqx.io",
        "company": "EMQ Technologies Co., Ltd",
        "website": "https://www.emqx.io"
      },
      "helpUrl": {
        "en_US": "https://github.com/lf-edge/ekuiper/blob/master/docs/en_US/sqls/query_language_elements.md",
        "zh_CN": "https://github.com/lf-edge/ekuiper/blob/master/docs/zh_CN/sqls/query_language_elements.md"
      },
      "description": {
        "en_US": "An operation to invoke a function or multiple functions",
        "zh_CN": "用于调用或嵌套调用函数的操作"
      }
    },
    "properties": [
      {
        "name": "expr",
        "default": "",
        "optional": false,
        "control": "text",
        "type": "string",
        "hint": {
          "en_US": "Function call expression",
          "zh_CN": "函数调用语句"
        },
        "label": {
          "en_US": "Expression",
          "zh_CN": "函数语句"
        }
      }
    ],
    "node": {
      "display": false,
      "category": "operator",
      "input": {
        "type": "any",
        "rowType": "any",
        "collectionType": "single"
      },
      "output": {
        "type": "same",
        "strategy": "append"
      },
      "icon": "iconPath",
      "label": {
        "en": "Function",
        "zh": "函数"
      }
    }
  },
  "groupby": {
    "name": "groupby",
    "about": {
      "trial": false,
      "author": {
        "name": "EMQ",
        "email": "contact@emqx.io",
        "company": "EMQ Technologies Co., Ltd",
        "website": "https://www.emqx.io"
      },
      "helpUrl": {
        "en_US": "https://github.com/lf-edge/ekuiper/blob/master/docs/en_US/sqls/query_language_elements.md",
        "zh_CN": "https://github.com/lf-edge/ekuiper/blob/master/docs/zh_CN/sqls/query_language_elements.md"
      },
      "description": {
        "en_US": "An operation to group the events by the condition.",
        "zh_CN": "用于按条件对事件进行分组的操作。"
      }
    },
    "properties": [
      {
        "name": "dimensions",
        "default": "",
        "optional": false,
        "control": "text",
        "type": "list_string",
        "hint": {
          "en_US": "the dimension fields to group by",
          "zh_CN": "分组的维度字段"
        },
        "label": {
          "en_US": "Dimensions",
          "zh_CN": "维度"
        }
      }
    ],
    "node": {
      "display": true,
      "category": "operator",
      "input": {
        "type": "collection",
        "rowType": "single",
        "collectionType": "any"
      },
      "output": {
        "type": "collection",
        "strategy": "grouped"
      },
      "icon": "iconPath",
      "label": {
        "en": "Group By",
        "zh": "分组"
      }
    }
  },
  "join": {
    "name": "join",
    "about": {
      "trial": false,
      "author": {
        "name": "EMQ",
        "email": "contact@emqx.io",
        "company": "EMQ Technologies Co., Ltd",
        "website": "https://www.emqx.io"
      },
      "helpUrl": {
        "en_US": "https://github.com/lf-edge/ekuiper/blob/master/docs/en_US/sqls/query_language_elements.md",
        "zh_CN": "https://github.com/lf-edge/ekuiper/blob/master/docs/zh_CN/sqls/query_language_elements.md"
      },
      "description": {
        "en_US": "An operation to combine rows from two or more tables, based on a related column between them.",
        "zh_CN": "用于基于两个或多个表之间的相关列连接行的操作。"
      }
    },
    "properties": [
      {
        "name": "from",
        "default": "",
        "optional": false,
        "control": "text",
        "type": "string",
        "hint": {
          "en_US": "From table name",
          "zh_CN": "来源表的名字"
        },
        "label": {
          "en_US": "From",
          "zh_CN": "来源表"
        }
      },
      {
        "name": "joins",
        "optional": false,
        "control": "list",
        "type": "list_object",
        "hint": {
          "en_US": "Join conditions",
          "zh_CN": "连接条件"
        },
        "label": {
          "en_US": "Joins",
          "zh_CN": "连接"
        },
        "default": [
          {
            "name": "name",
            "default": "",
            "optional": false,
            "control": "text",
            "type": "string",
            "hint": {
              "en_US": "Join table name",
              "zh_CN": "连接的表名"
            },
            "label": {
              "en_US": "Table Name",
              "zh_CN": "表名"
            }
          },
          {
            "name": "type",
            "default": "",
            "optional": false,
            "control": "text",
            "type": "string",
            "values": [
              "inner",
              "left",
              "right",
              "full",
              "cross"
            ],
            "hint": {
              "en_US": "Join type",
              "zh_CN": "连接类型"
            },
            "label": {
              "en_US": "Type",
              "zh_CN": "类型"
            }
          },
          {
            "name": "on",
            "default": "",
            "optional": false,
            "control": "text",
            "type": "string",
            "hint": {
              "en_US": "join condition expression",
              "zh_CN": "连接条件语句"
            },
            "label": {
              "en_US": "Condition",
              "zh_CN": "条件"
            }
          }
        ]
      }
    ],
    "node": {
      "display": true,
      "category": "operator",
      "input": {
        "type": "collection",
        "rowType": "single",
        "collectionType": "single"
      },
      "output": {
        "type": "collection",
        "strategy": "append"
      },
      "icon": "iconPath",
      "label": {
        "en": "Join",
        "zh": "连接"
      }
    }
  },
  "orderby": {
    "name": "orderby",
    "about": {
      "trial": false,
      "author": {
        "name": "EMQ",
        "email": "contact@emqx.io",
        "company": "EMQ Technologies Co., Ltd",
        "website": "https://www.emqx.io"
      },
      "helpUrl": {
        "en_US": "https://github.com/lf-edge/ekuiper/blob/master/docs/en_US/sqls/query_language_elements.md",
        "zh_CN": "https://github.com/lf-edge/ekuiper/blob/master/docs/zh_CN/sqls/query_language_elements.md"
      },
      "description": {
        "en_US": "An operation to order the rows.",
        "zh_CN": "用于排序的操作"
      }
    },
    "properties": [
      {
        "name": "sorts",
        "optional": false,
        "control": "list",
        "type": "list_object",
        "hint": {
          "en_US": "order expression",
          "zh_CN": "排序语句"
        },
        "label": {
          "en_US": "Order",
          "zh_CN": "排序"
        },
        "default": [
          {
            "name": "field",
            "default": "",
            "optional": false,
            "control": "text",
            "type": "string",
            "hint": {
              "en_US": "Order by field",
              "zh_CN": "用于排序的字段名"
            },
            "label": {
              "en_US": "Field",
              "zh_CN": "字段"
            }
          },
          {
            "name": "order",
            "default": false,
            "optional": false,
            "control": "checkbox",
            "type": "boolean",
            "hint": {
              "en_US": "Order by descending",
              "zh_CN": "是否降序"
            },
            "label": {
              "en_US": "Descending",
              "zh_CN": "降序"
            }
          }
        ]
      }
    ],
    "node": {
      "display": true,
      "category": "operator",
      "input": {
        "type": "any",
        "rowType": "any",
        "collectionType": "any"
      },
      "output": {
        "type": "same",
        "strategy": "keep"
      },
      "icon": "iconPath",
      "label": {
        "en": "Sort",
        "zh": "排序"
      }
    }
  },
  "pick": {
    "name": "pick",
    "about": {
      "trial": false,
      "author": {
        "name": "EMQ",
        "email": "contact@emqx.io",
        "company": "EMQ Technologies Co., Ltd",
        "website": "https://www.emqx.io"
      },
      "helpUrl": {
        "en_US": "https://github.com/lf-edge/ekuiper/blob/master/docs/en_US/sqls/query_language_elements.md",
        "zh_CN": "https://github.com/lf-edge/ekuiper/blob/master/docs/zh_CN/sqls/query_language_elements.md"
      },
      "description": {
        "en_US": "An operation to pick the selected fields.",
        "zh_CN": "用于选取字段的操作"
      }
    },
    "properties": [
      {
        "name": "fields",
        "default": "",
        "optional": false,
        "control": "list",
        "type": "list_string",
        "hint": {
          "en_US": "select fields",
          "zh_CN": "选取字段"
        },
        "label": {
          "en_US": "Fields",
          "zh_CN": "字段"
        }
      }
    ],
    "node": {
      "display": true,
      "category": "operator",
      "input": {
        "type": "any",
        "rowType": "any",
        "collectionType": "any"
      },
      "output": {
        "type": "same",
        "strategy": "pick"
      },
      "icon": "iconPath",
      "label": {
        "en": "Pick",
        "zh": "选择"
      }
    }
  },
  "script": {
    "name": "script",
    "about": {
      "trial": false,
      "author": {
        "name": "EMQ",
        "email": "contact@emqx.io",
        "company": "EMQ Technologies Co., Ltd",
        "website": "https://www.emqx.io"
      },
      "helpUrl": {
        "en_US": "https://github.com/lf-edge/ekuiper/blob/master/docs/en_US/sqls/query_language_elements.md",
        "zh_CN": "https://github.com/lf-edge/ekuiper/blob/master/docs/zh_CN/sqls/query_language_elements.md"
      },
      "description": {
        "en_US": "An operation to run script against the message",
        "zh_CN": "用于针对数据运行脚本的操作"
      }
    },
    "properties": [
      {
        "name": "script",
        "default": "",
        "optional": false,
        "control": "textarea",
        "type": "string",
        "hint": {
          "en_US": "The script text, now supports JavaScript only. Must have a function named exec, whose parameter is the message and the return value must be the processed message.",
          "zh_CN": "脚本函数的文本，支持javascript。必须包含一个函数，函数名为exec，参数为message，返回值为处理后的message"
        },
        "label": {
          "en_US": "Script",
          "zh_CN": "脚本"
        }
      }
    ],
    "node": {
      "display": false,
      "category": "operator",
      "input": {
        "type": "row",
        "rowType": "any",
        "collectionType": "any"
      },
      "output": {
        "type": "same",
        "strategy": "keep"
      },
      "icon": "iconPath",
      "label": {
        "en": "Script",
        "zh": "脚本"
      }
    }
  },
  "switch": {
    "name": "switch",
    "about": {
      "trial": false,
      "author": {
        "name": "EMQ",
        "email": "contact@emqx.io",
        "company": "EMQ Technologies Co., Ltd",
        "website": "https://www.emqx.io"
      },
      "helpUrl": {
        "en_US": "https://github.com/lf-edge/ekuiper/blob/master/docs/en_US/sqls/query_language_elements.md",
        "zh_CN": "https://github.com/lf-edge/ekuiper/blob/master/docs/zh_CN/sqls/query_language_elements.md"
      },
      "description": {
        "en_US": "An operation to route events to different branches based on a case condition similar to switch statement in programming languages.",
        "zh_CN": "用于根据条件分流数据的操作，类似编程语言中的 switch 语句。"
      }
    },
    "properties": [
      {
        "name": "cases",
        "optional": false,
        "control": "list",
        "type": "string",
        "hint": {
          "en_US": "case condition expression",
          "zh_CN": "分流条件语句"
        },
        "label": {
          "en_US": "Cases",
          "zh_CN": "条件"
        }
      },
      {
        "name": "stopAtFirstMatch",
        "default": false,
        "optional": false,
        "control": "checkbox",
        "type": "boolean",
        "hint": {
          "en_US": "Stop at first match",
          "zh_CN": "接受第一条匹配信息后停止"
        },
        "label": {
          "en_US": "Stop at first match",
          "zh_CN": "接受第一条匹配信息后停止"
        }
      }
    ],
    "node": {
      "display": true,
      "category": "operator",
      "input": {
        "type": "any",
        "rowType": "any",
        "collectionType": "any"
      },
      "output": {
        "type": "same",
        "strategy": "keep"
      },
      "icon": "iconPath",
      "label": {
        "en": "Switch",
        "zh": "Switch"
      }
    }
  },
  "window": {
    "name": "window",
    "about": {
      "trial": false,
      "author": {
        "name": "EMQ",
        "email": "contact@emqx.io",
        "company": "EMQ Technologies Co., Ltd",
        "website": "https://www.emqx.io"
      },
      "helpUrl": {
        "en_US": "https://github.com/lf-edge/ekuiper/blob/master/docs/en_US/sqls/query_language_elements.md",
        "zh_CN": "https://github.com/lf-edge/ekuiper/blob/master/docs/zh_CN/sqls/query_language_elements.md"
      },
      "description": {
        "en_US": "An operation to create a streaming window",
        "zh_CN": "用于创建窗口的操作"
      }
    },
    "properties": [
      {
        "name": "type",
        "default": "",
        "optional": false,
        "control": "select",
        "type": "string",
        "values": [
          "tumblingwindow",
          "hoppingwindow",
          "slidingwindow",
          "sessionwindow",
          "countwindow"
        ],
        "hint": {
          "en_US": "window type",
          "zh_CN": "窗口类型"
        },
        "label": {
          "en_US": "Window Type",
          "zh_CN": "窗口类型"
        }
      },
      {
        "name": "unit",
        "default": "",
        "optional": false,
        "control": "text",
        "type": "string",
        "values": [
          "ms",
          "ss",
          "mi",
          "hh",
          "dd"
        ],
        "hint": {
          "en_US": "Time unit for the window",
          "zh_CN": "窗口的时间单位"
        },
        "label": {
          "en_US": "Time Unit",
          "zh_CN": "时间单位"
        }
      },
      {
        "name": "size",
        "default": "",
        "optional": false,
        "control": "text",
        "type": "int",
        "hint": {
          "en_US": "Window Length",
          "zh_CN": "窗口长度"
        },
        "label": {
          "en_US": "Window Length",
          "zh_CN": "窗口长度"
        }
      },
      {
        "name": "interval",
        "default": "",
        "optional": false,
        "control": "text",
        "type": "int",
        "hint": {
          "en_US": "Window trigger interval",
          "zh_CN": "窗口触发周期"
        },
        "label": {
          "en_US": "Window Trigger Interval",
          "zh_CN": "窗口触发周期"
        }
      }
    ],
    "node": {
      "display": false,
      "category": "operator",
      "input": {
        "type": "row",
        "rowType": "any",
        "collectionType": "any",
        "allowMulti": true
      },
      "output": {
        "type": "collection",
        "strategy": "append"
      },
      "icon": "iconPath",
      "label": {
        "en": "Window",
        "zh": "窗口"
      }
    }
  }
};

export const BUILTIN_OPERATOR_LIST: OperatorNodeSchema[] = Object.values(BUILTIN_OPERATORS);

export function getOperatorSchema(name: string): OperatorNodeSchema | undefined {
  return BUILTIN_OPERATORS[name.toLowerCase().trim()];
}
