import type { FlowRevisionRecord } from '@/lib/flows/persistence/flow-revision-repository';

export interface FlowRevisionMetadata {
  id: string;
  flowId: string;
  revisionNumber: number;
  semanticHash: string;
  layoutHash: string;
  compilerVersion: number | null;
  createdBy: string | null;
  createdAt: Date;
  message: string | null;
}

export function toRevisionMetadata(
  record: FlowRevisionRecord,
): FlowRevisionMetadata {
  return {
    id: record.id,
    flowId: record.flowId,
    revisionNumber: record.revisionNumber,
    semanticHash: record.semanticHash,
    layoutHash: record.layoutHash,
    compilerVersion: record.compilerVersion,
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    message: record.message,
  };
}

export interface FlowRevisionDetail {
  id: string;
  flowId: string;
  revisionNumber: number;
  semanticDocument: FlowRevisionRecord['semanticDocument'];
  layoutDocument: FlowRevisionRecord['layoutDocument'];
  semanticHash: string;
  layoutHash: string;
  compilerVersion: number | null;
  createdBy: string | null;
  createdAt: Date;
  message: string | null;
}

export function toRevisionDetail(
  record: FlowRevisionRecord,
): FlowRevisionDetail {
  return {
    id: record.id,
    flowId: record.flowId,
    revisionNumber: record.revisionNumber,
    semanticDocument: record.semanticDocument,
    layoutDocument: record.layoutDocument,
    semanticHash: record.semanticHash,
    layoutHash: record.layoutHash,
    compilerVersion: record.compilerVersion,
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    message: record.message,
  };
}
