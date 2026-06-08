export { prisma, default as db } from './client.js';
export { Prisma, PrismaClient } from '@prisma/client';
export type {
  Agent,
  Lead,
  Conversation,
  Message,
  QualificationResult,
  FollowUpJob,
  SiteVisit,
  Notification,
  StateTransition,
  Property,
  AgentAvailability,
} from '@prisma/client';
export {
  LeadState,
  LeadClassification,
  MessageRole,
  MessageDirection,
  FollowUpStatus,
  SiteVisitStatus,
  NotificationType,
} from '@prisma/client';
