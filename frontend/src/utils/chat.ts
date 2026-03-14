import type { Conversation, Message } from "../types";

export type MessagesByConversation = Record<number, Message[]>;

export function sortConversations(conversations: Conversation[]) {
  return [...conversations].sort((left, right) => {
    const rightStamp = right.lastMessageAt ?? right.createdAt;
    const leftStamp = left.lastMessageAt ?? left.createdAt;
    return new Date(rightStamp).getTime() - new Date(leftStamp).getTime();
  });
}

export function upsertConversation(conversations: Conversation[], incoming: Conversation) {
  const next = conversations.filter((conversation) => conversation.id !== incoming.id);
  next.unshift(incoming);
  return sortConversations(next);
}

export function updateConversationPreview(conversations: Conversation[], message: Message) {
  return sortConversations(
    conversations.map((conversation) =>
      conversation.id === message.conversationId
        ? {
            ...conversation,
            lastMessageText: getMessagePreviewText(message),
            lastMessageAt: message.sentAt
          }
        : conversation
    )
  );
}

export function getMessagePreviewText(message: Message) {
  if (message.deletedAt) {
    return "This message was deleted.";
  }

  if (message.text.trim()) {
    return message.text;
  }

  if (message.mediaContentType?.startsWith("image/")) {
    return "Photo";
  }

  if (message.mediaFileName) {
    return `File: ${message.mediaFileName}`;
  }

  if (message.mediaUrl) {
    return "Attachment";
  }

  return "";
}

export function formatMessageTime(timestamp?: string | null) {
  if (!timestamp) {
    return "";
  }

  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

export function formatSidebarDate(timestamp?: string | null) {
  if (!timestamp) {
    return "";
  }

  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric"
  }).format(new Date(timestamp));
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatFileSize(size?: number | null) {
  if (!size || size < 1) {
    return "";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const digits = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}
