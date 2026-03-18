export type FriendshipStatus = "none" | "incoming" | "outgoing" | "friends";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  profileImageUrl?: string | null;
  bio?: string | null;
  chatThemePreference?: "system" | "light" | "dark" | null;
  chatWallpaperPreference?: "default" | "mist" | "mint" | "lavender" | "sunset" | "midnight" | null;
  friendshipStatus?: FriendshipStatus;
  friendshipRequestId?: number | null;
};

export type Session = {
  token: string;
  user: AuthUser;
};

export type Conversation = {
  id: number;
  isGroup: boolean;
  displayName: string;
  groupName?: string | null;
  adminUserId?: string | null;
  groupImageUrl?: string | null;
  groupRules?: string | null;
  isTemporary?: boolean;
  expiresAt?: string | null;
  canManage?: boolean;
  createdAt: string;
  lastMessageText?: string | null;
  lastMessageAt?: string | null;
  participants: AuthUser[];
};

export type Message = {
  id: number;
  conversationId: number;
  senderId: string;
  clientMessageId?: string | null;
  senderDisplayName: string;
  text: string;
  mediaUrl?: string | null;
  mediaContentType?: string | null;
  mediaFileName?: string | null;
  mediaFileSize?: number | null;
  localStatus?: "sending" | "failed" | null;
  sentAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
};

export type MessageReceipt = {
  id: number;
  conversationId: number;
  deliveredAt?: string | null;
  readAt?: string | null;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type ForgotPasswordRequest = {
  email: string;
};

export type ForgotPasswordResponse = {
  email: string;
  resetToken: string;
};

export type ResetPasswordRequest = {
  email: string;
  token: string;
  newPassword: string;
};

export type RegisterRequest = LoginRequest & {
  displayName: string;
};

export type CreateGroupConversationRequest = {
  participantIds: string[];
  groupName: string;
  isTemporary: boolean;
  expiresInHours?: number;
};

export type UpdateProfileRequest = {
  displayName: string;
  profileImageUrl?: string | null;
  bio?: string | null;
  chatThemePreference?: "system" | "light" | "dark" | null;
  chatWallpaperPreference?: "default" | "mist" | "mint" | "lavender" | "sunset" | "midnight" | null;
};

export type UpdateGroupSettingsRequest = {
  groupName: string;
  groupImageUrl?: string | null;
  groupRules?: string | null;
};

export type UpdateConversationParticipantsRequest = {
  participantIds: string[];
};
