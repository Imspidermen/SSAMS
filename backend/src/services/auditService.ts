import { prisma } from '../db/prisma';
import { logger } from '../utils/logger';

export interface AuditEntry {
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Persists a security-relevant audit log entry. Never pass biometric
 * data (embeddings/images) in `metadata` - only booleans/scores/ids.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata as never,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    });
  } catch (err) {
    // Audit logging must never crash the primary request flow.
    logger.error({ err, action: entry.action }, 'Failed to write audit log');
  }
}
