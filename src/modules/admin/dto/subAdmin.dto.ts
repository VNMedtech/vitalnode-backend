import type { AdminModule } from "../../../shared/enums/adminModule.enum.js";
import type {
  SubAdminDetailDto,
  SubAdminListItemDto,
} from "../types/subAdmin.types.js";

type SubAdminRecord = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  status: string;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
  subAdminModules: Array<{ module: AdminModule | string }>;
};

function toModules(record: SubAdminRecord): AdminModule[] {
  return record.subAdminModules.map((row) => row.module as AdminModule);
}

export function toSubAdminListItemDto(record: SubAdminRecord): SubAdminListItemDto {
  return {
    id: record.id,
    email: record.email,
    firstName: record.firstName,
    lastName: record.lastName,
    phoneNumber: record.phoneNumber,
    status: record.status,
    modules: toModules(record),
    mustChangePassword: record.mustChangePassword,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toSubAdminDetailDto(
  record: SubAdminRecord,
  lastLoginAt: Date | null,
): SubAdminDetailDto {
  return {
    ...toSubAdminListItemDto(record),
    lastLoginAt,
  };
}
