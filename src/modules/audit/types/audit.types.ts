export interface AuditActorDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface AuditLogListItemDto {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  actor: AuditActorDto;
}

export interface AuditLogDetailsDto extends AuditLogListItemDto {
  metadata: unknown | null;
}

