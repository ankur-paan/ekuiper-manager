"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, X } from "lucide-react";

interface DataFilterBarProps {
  value: string;
  onChange: (value: string) => void;
  availableFields: string[];
}

export function DataFilterBar({
  value,
  onChange,
  availableFields,
}: DataFilterBarProps) {
  const handleFieldSelect = (field: string) => {
    const currentParts = value.split(":");
    if (currentParts.length > 1) {
      onChange(`${field}:${currentParts[1]}`);
    } else {
      onChange(`${field}:`);
    }
  };

  const handleClear = () => {
    onChange("");
  };

  return (
    <div className="flex items-center gap-2 mb-4">
      <Filter className="h-4 w-4 text-muted-foreground" />
      
      {availableFields.length > 0 && (
        <Select onValueChange={handleFieldSelect}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Field" />
          </SelectTrigger>
          <SelectContent>
            {availableFields.map((field) => (
              <SelectItem key={field} value={field}>
                {field}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Input
        placeholder="Filter: field:value (e.g., status:active)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1"
      />

      {value && (
        <Button variant="ghost" size="icon" onClick={handleClear}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
