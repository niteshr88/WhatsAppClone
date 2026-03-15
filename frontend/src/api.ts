import { HubConnectionBuilder, HubConnectionState, LogLevel } from "@microsoft/signalr";
import type {
  AuthUser,
  Conversation,
  CreateGroupConversationRequest,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  Message,
  RegisterRequest,
  ResetPasswordRequest,
  Session,
  UpdateProfileRequest
} from "./types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const HUB_URL = (import.meta.env.VITE_HUB_URL as string | undefined) ?? `${API_BASE_URL}/chatHub`;

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";
type WebPushSubscriptionPayload = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

function resolvePath(path: string) {
  return `${API_BASE_URL}${path}`;
}

async function parseErrorMessage(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = await response.json();

    if (typeof payload === "string" && payload.trim()) {
      return payload;
    }

    if (Array.isArray(payload)) {
      const descriptions = payload
        .map((entry) => {
          if (typeof entry === "string") {
            return entry;
          }

          if (entry && typeof entry === "object" && "description" in entry && typeof entry.description === "string") {
            return entry.description;
          }

          return "";
        })
        .filter(Boolean);

      if (descriptions.length) {
        return descriptions.join(" ");
      }
    }

    if (payload && typeof payload === "object") {
      if ("message" in payload && typeof payload.message === "string" && payload.message.trim()) {
        return payload.message;
      }

      if ("title" in payload && typeof payload.title === "string" && payload.title.trim()) {
        return payload.title;
      }
    }
  }

  const errorText = await response.text();
  return errorText || `Request failed with status ${response.status}`;
}

async function request<T>(path: string, method: HttpMethod, token?: string, body?: unknown): Promise<T> {
  const response = await fetch(resolvePath(path), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
}

export function register(payload: RegisterRequest) {
  return request<string>("/api/Auth/register", "POST", undefined, payload);
}

export function login(payload: LoginRequest) {
  return request<Session>("/api/Auth/login", "POST", undefined, payload);
}

export function forgotPassword(payload: ForgotPasswordRequest) {
  return request<ForgotPasswordResponse>("/api/Auth/forgot-password", "POST", undefined, payload);
}

export function resetPassword(payload: ResetPasswordRequest) {
  return request<string>("/api/Auth/reset-password", "POST", undefined, payload);
}

export function getCurrentUser(token: string) {
  return request<AuthUser>("/api/Users/me", "GET", token);
}

export function updateCurrentUser(token: string, payload: UpdateProfileRequest) {
  return request<AuthUser>("/api/Users/me", "PUT", token, payload);
}

export function getUsers(token: string, search = "") {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return request<AuthUser[]>(`/api/Users${query}`, "GET", token);
}

export function getConversations(token: string) {
  return request<Conversation[]>("/api/Conversations", "GET", token);
}

export function createConversation(token: string, participantIds: string[]) {
  return request<Conversation>("/api/Conversations", "POST", token, { participantIds });
}

export function createGroupConversation(token: string, payload: CreateGroupConversationRequest) {
  return request<Conversation>("/api/Conversations", "POST", token, payload);
}

export function deleteConversation(token: string, conversationId: number) {
  return request<void>(`/api/Conversations/${conversationId}`, "DELETE", token);
}

export function getMessages(token: string, conversationId: number) {
  return request<Message[]>(`/api/Messages/conversation/${conversationId}`, "GET", token);
}

export function createMessage(token: string, conversationId: number, text: string, clientMessageId?: string) {
  return request<Message>("/api/Messages", "POST", token, { conversationId, text, clientMessageId });
}

export async function uploadMessageMedia(token: string, conversationId: number, file: File, clientMessageId?: string) {
  const formData = new FormData();
  formData.append("conversationId", conversationId.toString());
  if (clientMessageId) {
    formData.append("clientMessageId", clientMessageId);
  }
  formData.append("file", file);

  const response = await fetch(resolvePath("/api/Messages/media"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as Message;
}

export function updateMessage(token: string, messageId: number, text: string) {
  return request<Message>(`/api/Messages/${messageId}`, "PUT", token, { text });
}

export function deleteMessage(token: string, messageId: number) {
  return request<Message>(`/api/Messages/${messageId}`, "DELETE", token);
}

export function markConversationRead(token: string, conversationId: number) {
  return request<void>(`/api/Messages/conversation/${conversationId}/read`, "POST", token);
}

export function sendFriendRequest(token: string, recipientId: string) {
  return request<void>("/api/Friendships/requests", "POST", token, { recipientId });
}

export function acceptFriendRequest(token: string, requestId: number) {
  return request<void>(`/api/Friendships/requests/${requestId}/accept`, "POST", token);
}

export function declineFriendRequest(token: string, requestId: number) {
  return request<void>(`/api/Friendships/requests/${requestId}/decline`, "POST", token);
}

export function createChatConnection(token: string) {
  return new HubConnectionBuilder()
    .withUrl(HUB_URL, {
      accessTokenFactory: () => token
    })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build();
}

export function getWebPushPublicKey(token: string) {
  return request<{ publicKey: string }>("/api/PushSubscriptions/public-key", "GET", token);
}

export function saveWebPushSubscription(token: string, payload: WebPushSubscriptionPayload) {
  return request<void>("/api/PushSubscriptions", "POST", token, payload);
}

export function resolveMediaUrl(path?: string | null) {
  if (!path) {
    return "";
  }

  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) {
    return path;
  }

  return resolvePath(path);
}

export { API_BASE_URL, HUB_URL, HubConnectionState };
