import type { UserRole } from "../../../shared/enums/userRole.enum.js";
import type { UserStatus } from "../../../shared/enums/userStatus.enum.js";

export interface BuyerProfileSummary {
  id: string;
  buyerType: string;
}

export interface SellerProfileSummary {
  id: string;
  businessName: string;
  approvalStatus: string;
}

export interface DeliveryPartnerProfileSummary {
  id: string;
  city: string;
  state: string;
  country: string;
}

export interface UserProfileDto {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  profileImage: string | null;
  createdAt: Date;
  updatedAt: Date;
  buyerProfile: BuyerProfileSummary | null;
  sellerProfile: SellerProfileSummary | null;
  deliveryPartnerProfile: DeliveryPartnerProfileSummary | null;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string | null;
  profileImage?: string | null;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}
