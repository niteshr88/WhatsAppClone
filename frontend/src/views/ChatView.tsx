import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useTransition
} from "react";
import type { HubConnection } from "@microsoft/signalr";
import { useSearchParams } from "react-router-dom";
import {
  acceptFriendRequest,
  addGroupParticipants,
  HubConnectionState,
  declineFriendRequest,
  createChatConnection,
  createConversation,
  createGroupConversation,
  createMessage,
  deleteConversation,
  deleteMessage,
  getConversations,
  getCurrentUser,
  getMessages,
  getWebPushPublicKey,
  getUsers,
  markConversationRead,
  removeGroupParticipant,
  resolveMediaUrl,
  saveWebPushSubscription,
  sendFriendRequest,
  updateGroupSettings,
  uploadMessageMedia,
  updateMessage,
  updateCurrentUser
} from "../api";
import type {
  AuthUser,
  Conversation,
  FriendshipStatus,
  Message,
  MessageReceipt,
  Session,
  UpdateGroupSettingsRequest,
  UpdateProfileRequest
} from "../types";
import {
  getMessagePreviewText,
  sortConversations,
  updateConversationPreview,
  upsertConversation,
  type MessagesByConversation
} from "../utils/chat";
import {
  ensureBrowserPushSubscription,
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  showChatNotification,
  type BrowserNotificationPermission
} from "../utils/notifications";
import { deletePendingMediaBlob, getPendingMediaBlob, savePendingMediaBlob } from "../utils/pendingMedia";
import ChatPanel from "./chat/ChatPanel";
import PeopleSidebar from "./chat/PeopleSidebar";
import ProfileSidebar from "./chat/ProfileSidebar";
import ProfileSettingsPanel from "./chat/ProfileSettingsPanel";
import SettingsSidebar from "./chat/SettingsSidebar";
import SidebarRail from "./chat/SidebarRail";
import ChatSettingsPanel, { type ChatThemePreference, type ChatWallpaperPreference } from "./chat/ChatSettingsPanel";
import GroupSettingsModal from "./chat/GroupSettingsModal";


type ChatViewProps = {
  session: Session;
  onSessionChange: (session: Session | null) => void;
};

type PresenceChangedPayload = {
  userId: string;
  isOnline: boolean;
};

type FriendshipChangedPayload = {
  userId: string;
  friendshipStatus: FriendshipStatus;
  friendshipRequestId?: number | null;
};

type TypingPayload = {
  conversationId: number;
  userId: string;
  displayName?: string;
};

type PendingOutgoingTextMessage = {
  tempId: number;
  clientMessageId: string;
  conversationId: number;
  text: string;
  createdAt: string;
  status: "sending" | "failed";
};

type PendingOutgoingMediaMessage = {
  tempId: number;
  clientMessageId: string;
  conversationId: number;
  fileName: string;
  contentType: string;
  fileSize: number;
  createdAt: string;
  status: "sending" | "failed";
  previewUrl?: string | null;
};

type ConversationDeletedPayload = {
  conversationId: number;
};

type GroupExpiryUnit = "hours" | "days";

type CreateGroupFormState = {
  groupName: string;
  participantIds: string[];
  isTemporary: boolean;
  expiresValue: string;
  expiresUnit: GroupExpiryUnit;
};

const NOTIFICATION_PROMPT_STORAGE_KEY = "pulsechat.notifications.prompted";
const CHAT_THEME_STORAGE_KEY = "sandesaa.chat.theme";
const CHAT_WALLPAPER_STORAGE_KEY = "sandesaa.chat.wallpaper";

function getPendingQueueStorageKey(userId: string) {
  return `pulsechat.pending.${userId}`;
}

function getPendingMediaQueueStorageKey(userId: string) {
  return `pulsechat.pending-media.${userId}`;
}

function loadPendingOutgoingQueue(userId: string): PendingOutgoingTextMessage[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(getPendingQueueStorageKey(userId));

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as PendingOutgoingTextMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadPendingOutgoingMediaQueue(userId: string): PendingOutgoingMediaMessage[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(getPendingMediaQueueStorageKey(userId));

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as PendingOutgoingMediaMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serializePendingMediaQueue(queue: PendingOutgoingMediaMessage[]) {
  return queue.map(({ previewUrl: _previewUrl, ...queuedMessage }) => queuedMessage);
}

function createProfileForm(user: AuthUser): UpdateProfileRequest {
  return {
    displayName: user.displayName,
    profileImageUrl: user.profileImageUrl ?? "",
    bio: user.bio ?? "",
    chatThemePreference: user.chatThemePreference ?? "system",
    chatWallpaperPreference: user.chatWallpaperPreference ?? "default"
  };
}

function createInitialGroupForm(): CreateGroupFormState {
  return {
    groupName: "",
    participantIds: [],
    isTemporary: false,
    expiresValue: "24",
    expiresUnit: "hours"
  };
}

function loadStoredChatThemePreference(): ChatThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  const storedValue = window.localStorage.getItem(CHAT_THEME_STORAGE_KEY);
  return storedValue === "light" || storedValue === "dark" || storedValue === "system" ? storedValue : "system";
}

function loadStoredChatWallpaperPreference(): ChatWallpaperPreference {
  if (typeof window === "undefined") {
    return "default";
  }

  const storedValue = window.localStorage.getItem(CHAT_WALLPAPER_STORAGE_KEY);
  return storedValue === "mist" || storedValue === "mint" || storedValue === "lavender" || storedValue === "sunset" || storedValue === "midnight" || storedValue === "default"
    ? storedValue
    : "default";
}

function createGroupSettingsForm(conversation: Conversation): UpdateGroupSettingsRequest {
  return {
    groupName: conversation.groupName ?? conversation.displayName,
    groupImageUrl: conversation.groupImageUrl ?? "",
    groupRules: conversation.groupRules ?? ""
  };
}

function getExpiresInHours(groupForm: CreateGroupFormState) {
  if (!groupForm.isTemporary) {
    return undefined;
  }

  const parsedValue = Number.parseInt(groupForm.expiresValue, 10);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return Number.NaN;
  }

  return groupForm.expiresUnit === "days" ? parsedValue * 24 : parsedValue;
}

function formatGroupExpiry(expiresAt?: string | null) {
  if (!expiresAt) {
    return "Permanent group";
  }

  const diffMs = new Date(expiresAt).getTime() - Date.now();

  if (diffMs <= 0) {
    return "Expiring soon";
  }

  const totalHours = Math.ceil(diffMs / (1000 * 60 * 60));

  if (totalHours >= 24) {
    return `Expires in ${Math.ceil(totalHours / 24)}d`;
  }

  return `Expires in ${totalHours}h`;
}

function ChatView({ session, onSessionChange }: ChatViewProps) {
  const [searchParams] = useSearchParams();
  const [currentUser, setCurrentUser] = useState<AuthUser>(session.user);
  const [contacts, setContacts] = useState<AuthUser[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [messagesByConversation, setMessagesByConversation] = useState<MessagesByConversation>({});
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("Loading workspace...");
  const [workspaceError, setWorkspaceError] = useState("");
  const [notificationPermission, setNotificationPermission] = useState<BrowserNotificationPermission>(() =>
    getBrowserNotificationPermission()
  );
  const [pendingOutgoingQueue, setPendingOutgoingQueue] = useState<PendingOutgoingTextMessage[]>(() =>
    loadPendingOutgoingQueue(session.user.id)
  );
  const [pendingOutgoingMediaQueue, setPendingOutgoingMediaQueue] = useState<PendingOutgoingMediaMessage[]>(() =>
    loadPendingOutgoingMediaQueue(session.user.id)
  );
  const [connectionState, setConnectionState] = useState("offline");
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(() => new Set());
  const [typingByConversation, setTypingByConversation] = useState<Record<number, { userId: string; displayName: string }>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
  const [sidebarView, setSidebarView] = useState<"friends" | "requests" | "discover" | "profile" | "settings">("friends");
  const [settingsScreen, setSettingsScreen] = useState<"home" | "profile" | "chats">("home");
  const [settingsSearch, setSettingsSearch] = useState("");
  const [chatThemePreference, setChatThemePreference] = useState<ChatThemePreference>(() => session.user.chatThemePreference ?? loadStoredChatThemePreference());
  const [chatWallpaperPreference, setChatWallpaperPreference] = useState<ChatWallpaperPreference>(() => session.user.chatWallpaperPreference ?? loadStoredChatWallpaperPreference());
  const [chatThemeDraft, setChatThemeDraft] = useState<ChatThemePreference>(() => session.user.chatThemePreference ?? loadStoredChatThemePreference());
  const [chatWallpaperDraft, setChatWallpaperDraft] = useState<ChatWallpaperPreference>(() => session.user.chatWallpaperPreference ?? loadStoredChatWallpaperPreference());
  const [isThemeDialogOpen, setIsThemeDialogOpen] = useState(false);
  const [chatSettingsError, setChatSettingsError] = useState("");
  const [chatSettingsStatus, setChatSettingsStatus] = useState("");
  const [systemChatTheme, setSystemChatTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<UpdateProfileRequest>(() => createProfileForm(session.user));
  const [profileError, setProfileError] = useState("");
  const [profileStatus, setProfileStatus] = useState("");
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [groupForm, setGroupForm] = useState<CreateGroupFormState>(() => createInitialGroupForm());
  const [groupFormError, setGroupFormError] = useState("");
  const [isGroupSettingsOpen, setIsGroupSettingsOpen] = useState(false);
  const [groupSettingsForm, setGroupSettingsForm] = useState<UpdateGroupSettingsRequest>({ groupName: "", groupImageUrl: "", groupRules: "" });
  const [groupSettingsSelectedParticipantIds, setGroupSettingsSelectedParticipantIds] = useState<string[]>([]);
  const [groupSettingsError, setGroupSettingsError] = useState("");
  const [groupSettingsStatus, setGroupSettingsStatus] = useState("");
  const [isSending, startSendTransition] = useTransition();
  const [isUploadingMedia, startUploadTransition] = useTransition();
  const [isSavingProfile, startProfileTransition] = useTransition();
  const [isCreatingGroup, startCreateGroupTransition] = useTransition();
  const [isSavingGroupSettings, startGroupSettingsTransition] = useTransition();
  const [isSavingChatSettings, startChatSettingsTransition] = useTransition();
  const connectionRef = useRef<HubConnection | null>(null);
  const joinedConversationIdsRef = useRef<Set<number>>(new Set());
  const messageStreamRef = useRef<HTMLDivElement | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  const pendingOutgoingQueueRef = useRef<PendingOutgoingTextMessage[]>(pendingOutgoingQueue);
  const pendingOutgoingMediaQueueRef = useRef<PendingOutgoingMediaMessage[]>(pendingOutgoingMediaQueue);
  const nextTempMessageIdRef = useRef(
    [...pendingOutgoingQueue, ...pendingOutgoingMediaQueue].length
      ? Math.min(...[...pendingOutgoingQueue, ...pendingOutgoingMediaQueue].map((item) => item.tempId)) - 1
      : -1
  );
  const outgoingTypingConversationIdRef = useRef<number | null>(null);
  const outgoingTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const incomingTypingTimeoutsRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const requestedConversationId = Number(searchParams.get("conversationId") ?? "") || null;

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) ?? null,
    [activeConversationId, conversations]
  );
  const visibleContacts = useMemo(() => {
    const filter = debouncedSearch.trim().toLowerCase();
    const filteredContacts = !filter
      ? contacts
      : contacts.filter((contact) => `${contact.displayName} ${contact.email}`.toLowerCase().includes(filter));

    return [...filteredContacts].sort((left, right) => {
      const statusPriority: Record<FriendshipStatus, number> = {
        incoming: 0,
        friends: 1,
        outgoing: 2,
        none: 3
      };

      const leftPriority = statusPriority[left.friendshipStatus ?? "none"];
      const rightPriority = statusPriority[right.friendshipStatus ?? "none"];

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return left.displayName.localeCompare(right.displayName);
    });
  }, [contacts, debouncedSearch]);
  const incomingRequestContacts = useMemo(
    () => visibleContacts.filter((contact) => contact.friendshipStatus === "incoming"),
    [visibleContacts]
  );
  const friendContacts = useMemo(
    () => visibleContacts.filter((contact) => contact.friendshipStatus === "friends"),
    [visibleContacts]
  );
  const discoverContacts = useMemo(
    () => visibleContacts.filter((contact) => contact.friendshipStatus !== "incoming" && contact.friendshipStatus !== "friends"),
    [visibleContacts]
  );
  const groupConversations = useMemo(
    () => sortConversations(conversations.filter((conversation) => conversation.isGroup)),
    [conversations]
  );
  const groupCandidates = useMemo(
    () => contacts.filter((contact) => contact.id !== currentUser.id),
    [contacts, currentUser.id]
  );
  const conversationByUserId = useMemo(() => {
    const lookup = new Map<string, Conversation>();

    for (const conversation of conversations) {
      if (conversation.isGroup) {
        continue;
      }

      const otherParticipant = conversation.participants.find((participant) => participant.id !== currentUser.id);

      if (otherParticipant) {
        lookup.set(otherParticipant.id, conversation);
      }
    }

    return lookup;
  }, [conversations, currentUser.id]);
  const messages = activeConversationId ? messagesByConversation[activeConversationId] ?? [] : [];
  const activeTypingIndicator = useMemo(
    () => (activeConversationId ? typingByConversation[activeConversationId] ?? null : null),
    [activeConversationId, typingByConversation]
  );
  const activeDirectContact = useMemo(() => {
    if (!activeConversation || activeConversation.isGroup) {
      return null;
    }

    const otherParticipant = activeConversation.participants.find((participant) => participant.id !== currentUser.id);

    if (!otherParticipant) {
      return null;
    }

    return contacts.find((contact) => contact.id === otherParticipant.id) ?? null;
  }, [activeConversation, contacts, currentUser.id]);
  const activeConversationPresence = useMemo(() => {
    if (!activeConversation) {
      return {
        isOnline: false,
        subtitle: "Choose someone from the sidebar to start."
      };
    }

    if (activeConversation.isGroup) {
      const onlineCount = activeConversation.participants.filter(
        (participant) => participant.id !== currentUser.id && onlineUserIds.has(participant.id)
      ).length;
      const groupStatus = activeConversation.isTemporary ? formatGroupExpiry(activeConversation.expiresAt) : "Permanent group";

      return {
        isOnline: onlineCount > 0,
        subtitle: activeTypingIndicator
          ? `${activeTypingIndicator.displayName} is typing...`
          : onlineCount
            ? `${onlineCount} online • ${groupStatus}`
            : `${activeConversation.participants.length} participant${activeConversation.participants.length > 1 ? "s" : ""} • ${groupStatus}`
      };
    }

    const otherParticipant = activeConversation.participants.find((participant) => participant.id !== currentUser.id);
    const isOnline = otherParticipant ? onlineUserIds.has(otherParticipant.id) : false;

    return {
      isOnline,
      subtitle: activeTypingIndicator
        ? `${activeTypingIndicator.displayName} is typing...`
        : isOnline
          ? "Online now"
          : "Offline"
    };
  }, [activeConversation, activeTypingIndicator, currentUser.id, onlineUserIds]);
  const activeGroupConversation = activeConversation?.isGroup ? activeConversation : null;
  const canManageActiveGroup = Boolean(
    activeGroupConversation &&
    (activeGroupConversation.canManage || activeGroupConversation.adminUserId === currentUser.id)
  );
  const effectiveThemePreference = settingsScreen === "chats" ? chatThemeDraft : chatThemePreference;
  const effectiveWallpaperPreference = settingsScreen === "chats" ? chatWallpaperDraft : chatWallpaperPreference;
  const appliedChatTheme = effectiveThemePreference === "system" ? systemChatTheme : effectiveThemePreference;
  const availableGroupContacts = useMemo(
    () =>
      activeGroupConversation
        ? contacts.filter(
            (contact) =>
              contact.id !== currentUser.id &&
              !activeGroupConversation.participants.some((participant) => participant.id === contact.id)
          )
        : [],
    [activeGroupConversation, contacts, currentUser.id]
  );


  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    pendingOutgoingQueueRef.current = pendingOutgoingQueue;

    if (typeof window === "undefined") {
      return;
    }

    if (pendingOutgoingQueue.length) {
      window.localStorage.setItem(getPendingQueueStorageKey(session.user.id), JSON.stringify(pendingOutgoingQueue));
    } else {
      window.localStorage.removeItem(getPendingQueueStorageKey(session.user.id));
    }
  }, [pendingOutgoingQueue, session.user.id]);

  useEffect(() => {
    pendingOutgoingMediaQueueRef.current = pendingOutgoingMediaQueue;

    if (typeof window === "undefined") {
      return;
    }

    if (pendingOutgoingMediaQueue.length) {
      window.localStorage.setItem(
        getPendingMediaQueueStorageKey(session.user.id),
        JSON.stringify(serializePendingMediaQueue(pendingOutgoingMediaQueue))
      );
    } else {
      window.localStorage.removeItem(getPendingMediaQueueStorageKey(session.user.id));
    }
  }, [pendingOutgoingMediaQueue, session.user.id]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
    }, 240);

    return () => {
      clearTimeout(timeout);
    };
  }, [search]);

  useEffect(() => {
    setProfileForm(createProfileForm(currentUser));
    const nextThemePreference = currentUser.chatThemePreference ?? loadStoredChatThemePreference();
    const nextWallpaperPreference = currentUser.chatWallpaperPreference ?? loadStoredChatWallpaperPreference();
    setChatThemePreference(nextThemePreference);
    setChatWallpaperPreference(nextWallpaperPreference);
    setChatThemeDraft(nextThemePreference);
    setChatWallpaperDraft(nextWallpaperPreference);
  }, [currentUser]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = (matches: boolean) => {
      setSystemChatTheme(matches ? "dark" : "light");
    };
    const handleThemeChange = (event: MediaQueryListEvent) => {
      updateTheme(event.matches);
    };

    updateTheme(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleThemeChange);
      return () => mediaQuery.removeEventListener("change", handleThemeChange);
    }

    mediaQuery.addListener(handleThemeChange);
    return () => mediaQuery.removeListener(handleThemeChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(CHAT_THEME_STORAGE_KEY, chatThemePreference);
  }, [chatThemePreference]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(CHAT_WALLPAPER_STORAGE_KEY, chatWallpaperPreference);
  }, [chatWallpaperPreference]);

  useEffect(() => {
    if (!isGroupSettingsOpen) {
      return;
    }

    if (!activeGroupConversation) {
      setIsGroupSettingsOpen(false);
      setGroupSettingsSelectedParticipantIds([]);
      setGroupSettingsError("");
      setGroupSettingsStatus("");
      return;
    }

    setGroupSettingsForm(createGroupSettingsForm(activeGroupConversation));
  }, [activeGroupConversation, isGroupSettingsOpen]);

  useEffect(() => {
    setNotificationPermission(getBrowserNotificationPermission());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (notificationPermission !== "default") {
      return;
    }

    if (window.localStorage.getItem(NOTIFICATION_PROMPT_STORAGE_KEY) === "1") {
      return;
    }

    window.localStorage.setItem(NOTIFICATION_PROMPT_STORAGE_KEY, "1");

    void requestBrowserNotificationPermission().then((permission) => {
      setNotificationPermission(permission);

      if (permission === "granted") {
        setStatus("Notifications enabled.");
      }
    });
  }, [notificationPermission]);

  useEffect(() => {
    let disposed = false;

    async function syncWebPushSubscription() {
      if (notificationPermission !== "granted") {
        return;
      }

      try {
        const { publicKey } = await getWebPushPublicKey(session.token);
        const subscription = await ensureBrowserPushSubscription(publicKey);

        if (!subscription || disposed) {
          return;
        }

        await saveWebPushSubscription(session.token, subscription);
      } catch (caughtError) {
        if (!disposed) {
          setWorkspaceError(
            caughtError instanceof Error ? caughtError.message : "Unable to enable push notifications."
          );
        }
      }
    }

    void syncWebPushSubscription();

    return () => {
      disposed = true;
    };
  }, [notificationPermission, session.token]);

  const refreshContacts = useEffectEvent(async () => {
    const nextContacts = await getUsers(session.token);
    setContacts(nextContacts);
  });

  const createPendingTextMessage = useEffectEvent((queuedMessage: PendingOutgoingTextMessage): Message => ({
    id: queuedMessage.tempId,
    conversationId: queuedMessage.conversationId,
    senderId: currentUser.id,
    clientMessageId: queuedMessage.clientMessageId,
    senderDisplayName: currentUser.displayName,
    text: queuedMessage.text,
    sentAt: queuedMessage.createdAt,
    localStatus: queuedMessage.status,
    editedAt: null,
    deletedAt: null,
    deliveredAt: null,
    readAt: null
  }));

  const createPendingMediaMessage = useEffectEvent((queuedMessage: PendingOutgoingMediaMessage): Message => ({
    id: queuedMessage.tempId,
    conversationId: queuedMessage.conversationId,
    senderId: currentUser.id,
    clientMessageId: queuedMessage.clientMessageId,
    senderDisplayName: currentUser.displayName,
    text: "",
    mediaUrl: queuedMessage.previewUrl ?? "",
    mediaContentType: queuedMessage.contentType,
    mediaFileName: queuedMessage.fileName,
    mediaFileSize: queuedMessage.fileSize,
    sentAt: queuedMessage.createdAt,
    localStatus: queuedMessage.status,
    editedAt: null,
    deletedAt: null,
    deliveredAt: null,
    readAt: null
  }));

  const mergeIncomingMessage = useEffectEvent((message: Message) => {
    const normalizedMessage: Message = {
      ...message,
      localStatus: null
    };

    setMessagesByConversation((current) => {
      const existing = current[message.conversationId] ?? [];
      const matchedIndex = existing.findIndex(
        (entry) =>
          entry.id === message.id ||
          (!!normalizedMessage.clientMessageId && entry.clientMessageId === normalizedMessage.clientMessageId)
      );

      if (matchedIndex >= 0) {
        const currentMessage = existing[matchedIndex];
        const nextConversationMessages = [...existing];
        nextConversationMessages[matchedIndex] = {
          ...currentMessage,
          ...normalizedMessage,
          localStatus: null
        };

        return {
          ...current,
          [message.conversationId]: nextConversationMessages
        };
      }

      return {
        ...current,
        [message.conversationId]: [...existing, normalizedMessage]
      };
    });
    if (normalizedMessage.clientMessageId && !normalizedMessage.localStatus) {
      setPendingOutgoingQueue((current) =>
        current.filter((queuedMessage) => queuedMessage.clientMessageId !== normalizedMessage.clientMessageId)
      );
      setPendingOutgoingMediaQueue((current) =>
        current.filter((queuedMessage) => queuedMessage.clientMessageId !== normalizedMessage.clientMessageId)
      );
      void deletePendingMediaBlob(normalizedMessage.clientMessageId).catch(() => undefined);
    }
    setConversations((current) => updateConversationPreview(current, normalizedMessage));

    if (normalizedMessage.senderId !== currentUser.id && normalizedMessage.conversationId !== activeConversationId) {
      setUnreadCounts((current) => ({
        ...current,
        [normalizedMessage.conversationId]: (current[normalizedMessage.conversationId] ?? 0) + 1
      }));
    }
  });

  const syncPendingQueueMessages = useEffectEvent((queue: PendingOutgoingTextMessage[]) => {
    if (queue.length === 0) {
      return;
    }

    setMessagesByConversation((current) => {
      let didChange = false;
      const next: MessagesByConversation = { ...current };

      for (const queuedMessage of queue) {
        const pendingMessage = createPendingTextMessage(queuedMessage);
        const existing = next[queuedMessage.conversationId] ?? current[queuedMessage.conversationId] ?? [];
        const matchedIndex = existing.findIndex((message) => message.clientMessageId === queuedMessage.clientMessageId);

        if (matchedIndex >= 0) {
          const matchedMessage = existing[matchedIndex];

          if (matchedMessage.id > 0 && !matchedMessage.localStatus) {
            continue;
          }

          const updatedConversationMessages = [...existing];
          updatedConversationMessages[matchedIndex] = {
            ...matchedMessage,
            ...pendingMessage
          };
          next[queuedMessage.conversationId] = updatedConversationMessages;
          didChange = true;
          continue;
        }

        next[queuedMessage.conversationId] = [...existing, pendingMessage];
        didChange = true;
      }

      return didChange ? next : current;
    });

    setConversations((current) =>
      queue.reduce((nextConversations, queuedMessage) => updateConversationPreview(nextConversations, createPendingTextMessage(queuedMessage)), current)
    );
  });

  const syncPendingMediaQueueMessages = useEffectEvent((queue: PendingOutgoingMediaMessage[]) => {
    if (queue.length === 0) {
      return;
    }

    setMessagesByConversation((current) => {
      let didChange = false;
      const next: MessagesByConversation = { ...current };

      for (const queuedMessage of queue) {
        const pendingMessage = createPendingMediaMessage(queuedMessage);
        const existing = next[queuedMessage.conversationId] ?? current[queuedMessage.conversationId] ?? [];
        const matchedIndex = existing.findIndex((message) => message.clientMessageId === queuedMessage.clientMessageId);

        if (matchedIndex >= 0) {
          const matchedMessage = existing[matchedIndex];

          if (matchedMessage.id > 0 && !matchedMessage.localStatus) {
            continue;
          }

          const updatedConversationMessages = [...existing];
          updatedConversationMessages[matchedIndex] = {
            ...matchedMessage,
            ...pendingMessage
          };
          next[queuedMessage.conversationId] = updatedConversationMessages;
          didChange = true;
          continue;
        }

        next[queuedMessage.conversationId] = [...existing, pendingMessage];
        didChange = true;
      }

      return didChange ? next : current;
    });

    setConversations((current) =>
      queue.reduce((nextConversations, queuedMessage) => updateConversationPreview(nextConversations, createPendingMediaMessage(queuedMessage)), current)
    );
  });

  const updatePendingQueueItemStatus = useEffectEvent((clientMessageId: string, status: PendingOutgoingTextMessage["status"]) => {
    setPendingOutgoingQueue((current) =>
      current.map((queuedMessage) =>
        queuedMessage.clientMessageId === clientMessageId
          ? {
              ...queuedMessage,
              status
            }
          : queuedMessage
      )
    );
    setMessagesByConversation((current) => {
      let didChange = false;
      const next: MessagesByConversation = { ...current };

      for (const [conversationIdKey, conversationMessages] of Object.entries(current)) {
        const updatedConversationMessages = conversationMessages.map((message) => {
          if (message.clientMessageId !== clientMessageId) {
            return message;
          }

          didChange = true;
          return {
            ...message,
            localStatus: status
          };
        });

        next[Number(conversationIdKey)] = updatedConversationMessages;
      }

      return didChange ? next : current;
    });
  });

  const updatePendingMediaQueueItemStatus = useEffectEvent(
    (clientMessageId: string, status: PendingOutgoingMediaMessage["status"], previewUrl?: string | null) => {
      setPendingOutgoingMediaQueue((current) =>
        current.map((queuedMessage) =>
          queuedMessage.clientMessageId === clientMessageId
            ? {
                ...queuedMessage,
                status,
                previewUrl: previewUrl ?? queuedMessage.previewUrl
              }
            : queuedMessage
        )
      );
      setMessagesByConversation((current) => {
        let didChange = false;
        const next: MessagesByConversation = { ...current };

        for (const [conversationIdKey, conversationMessages] of Object.entries(current)) {
          const updatedConversationMessages = conversationMessages.map((message) => {
            if (message.clientMessageId !== clientMessageId) {
              return message;
            }

            didChange = true;
            return {
              ...message,
              mediaUrl: previewUrl ?? message.mediaUrl,
              localStatus: status
            };
          });

          next[Number(conversationIdKey)] = updatedConversationMessages;
        }

        return didChange ? next : current;
      });
    }
  );

  const applyReceiptUpdates = useEffectEvent((receipts: MessageReceipt[]) => {
    if (receipts.length === 0) {
      return;
    }

    setMessagesByConversation((current) => {
      let didChange = false;
      const receiptLookup = new Map(receipts.map((receipt) => [receipt.id, receipt]));
      const next: MessagesByConversation = { ...current };

      for (const [conversationIdKey, conversationMessages] of Object.entries(current)) {
        const conversationId = Number(conversationIdKey);
        const updatedMessages = conversationMessages.map((message) => {
          const receipt = receiptLookup.get(message.id);

          if (!receipt || receipt.conversationId !== conversationId) {
            return message;
          }

          didChange = true;

          return {
            ...message,
            deliveredAt: receipt.deliveredAt ?? null,
            readAt: receipt.readAt ?? null
          };
        });

        next[conversationId] = updatedMessages;
      }

      return didChange ? next : current;
    });
  });

  const applyMessagePatch = useEffectEvent((nextMessage: Message) => {
    let shouldUpdatePreview = false;

    setMessagesByConversation((current) => {
      const existing = current[nextMessage.conversationId] ?? [];
      const matchedIndex = existing.findIndex(
        (message) => message.id === nextMessage.id || (!!nextMessage.clientMessageId && message.clientMessageId === nextMessage.clientMessageId)
      );

      if (matchedIndex < 0) {
        return current;
      }

      shouldUpdatePreview = existing[existing.length - 1]?.id === existing[matchedIndex]?.id;

      return {
        ...current,
        [nextMessage.conversationId]: existing.map((message, index) =>
          index === matchedIndex
            ? {
                ...message,
                ...nextMessage,
                localStatus: null
              }
            : message
        )
      };
    });

    if (nextMessage.clientMessageId) {
      setPendingOutgoingQueue((current) =>
        current.filter((queuedMessage) => queuedMessage.clientMessageId !== nextMessage.clientMessageId)
      );
      setPendingOutgoingMediaQueue((current) =>
        current.filter((queuedMessage) => queuedMessage.clientMessageId !== nextMessage.clientMessageId)
      );
      void deletePendingMediaBlob(nextMessage.clientMessageId).catch(() => undefined);
    }

    if (shouldUpdatePreview) {
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === nextMessage.conversationId
            ? {
                ...conversation,
                lastMessageText: getMessagePreviewText(nextMessage),
                lastMessageAt: nextMessage.sentAt
              }
            : conversation
        )
      );
    }
  });

  const stopTypingSignal = useEffectEvent(async (conversationId: number) => {
    const connection = connectionRef.current;

    if (!connection || connection.state !== HubConnectionState.Connected) {
      return;
    }

    await connection.invoke("StopTyping", conversationId.toString()).catch(() => undefined);
  });

  const clearOutgoingTyping = useEffectEvent((conversationId?: number | null) => {
    if (outgoingTypingTimeoutRef.current) {
      clearTimeout(outgoingTypingTimeoutRef.current);
      outgoingTypingTimeoutRef.current = null;
    }

    const targetConversationId = conversationId ?? outgoingTypingConversationIdRef.current;

    if (!targetConversationId) {
      outgoingTypingConversationIdRef.current = null;
      return;
    }

    outgoingTypingConversationIdRef.current = null;
    void stopTypingSignal(targetConversationId);
  });

  const refreshIncomingTypingTimeout = useEffectEvent((conversationId: number) => {
    const currentTimeout = incomingTypingTimeoutsRef.current[conversationId];

    if (currentTimeout) {
      clearTimeout(currentTimeout);
    }

    incomingTypingTimeoutsRef.current[conversationId] = setTimeout(() => {
      delete incomingTypingTimeoutsRef.current[conversationId];
      setTypingByConversation((current) => {
        if (!current[conversationId]) {
          return current;
        }

        const next = { ...current };
        delete next[conversationId];
        return next;
      });
    }, 2200);
  });

  const clearIncomingTyping = useEffectEvent((conversationId: number, userId?: string) => {
    const currentTimeout = incomingTypingTimeoutsRef.current[conversationId];

    if (currentTimeout) {
      clearTimeout(currentTimeout);
      delete incomingTypingTimeoutsRef.current[conversationId];
    }

    setTypingByConversation((current) => {
      const currentTyping = current[conversationId];

      if (!currentTyping || (userId && currentTyping.userId !== userId)) {
        return current;
      }

      const next = { ...current };
      delete next[conversationId];
      return next;
    });
  });

  const handleDraftChange = useEffectEvent((value: string) => {
    setDraft(value);

    const activeId = activeConversationId;
    const connection = connectionRef.current;
    const trimmedValue = value.trim();

    if (!activeId || !connection || connection.state !== HubConnectionState.Connected) {
      if (!trimmedValue) {
        clearOutgoingTyping();
      }

      return;
    }

    if (!trimmedValue) {
      if (outgoingTypingConversationIdRef.current === activeId) {
        clearOutgoingTyping(activeId);
      }

      return;
    }

    const currentTypingConversationId = outgoingTypingConversationIdRef.current;

    if (currentTypingConversationId !== activeId) {
      if (currentTypingConversationId) {
        void stopTypingSignal(currentTypingConversationId);
      }

      outgoingTypingConversationIdRef.current = activeId;
      void connection.invoke("StartTyping", activeId.toString()).catch(() => undefined);
    }

    if (outgoingTypingTimeoutRef.current) {
      clearTimeout(outgoingTypingTimeoutRef.current);
    }

    outgoingTypingTimeoutRef.current = setTimeout(() => {
      const typingConversationId = outgoingTypingConversationIdRef.current;

      if (!typingConversationId) {
        return;
      }

      outgoingTypingConversationIdRef.current = null;
      void stopTypingSignal(typingConversationId);
    }, 1200);
  });

  const acknowledgeConversationRead = useEffectEvent(async (conversationId: number, conversationMessages?: Message[]) => {
    const nextConversationMessages = conversationMessages ?? messagesByConversation[conversationId] ?? [];
    const hasUnreadIncomingMessages = nextConversationMessages.some(
      (message) => message.senderId !== currentUser.id && !message.readAt
    );

    if (!hasUnreadIncomingMessages) {
      return;
    }

    try {
      const connection = connectionRef.current;

      if (connection && connection.state === HubConnectionState.Connected) {
        await connection.invoke("MarkConversationRead", conversationId.toString());
      } else {
        await markConversationRead(session.token, conversationId);
      }
    } catch {
      // Receipt updates are opportunistic; message rendering still works without them.
    }
  });

  const handleIncomingMessage = useEffectEvent((message: Message) => {
    mergeIncomingMessage(message);
    clearIncomingTyping(message.conversationId, message.senderId);

    if (
      message.senderId !== currentUser.id &&
      (document.hidden || message.conversationId !== activeConversationId) &&
      notificationPermission === "granted"
    ) {
      const conversation = conversationsRef.current.find((entry) => entry.id === message.conversationId);
      const otherParticipant = conversation?.participants.find((participant) => participant.id !== currentUser.id);
      const title = conversation?.displayName ?? message.senderDisplayName;
      const body = getMessagePreviewText(message) || "New message";
      void showChatNotification({
        title,
        body,
        conversationId: message.conversationId,
        icon: otherParticipant?.profileImageUrl ?? null
      });
    }

    if (message.senderId !== currentUser.id && message.conversationId === activeConversationId) {
      void acknowledgeConversationRead(message.conversationId, [
        ...(messagesByConversation[message.conversationId] ?? []),
        message
      ]);
    }
  });

  const sendQueuedTextMessage = useEffectEvent(async (queuedMessage: PendingOutgoingTextMessage) => {
    updatePendingQueueItemStatus(queuedMessage.clientMessageId, "sending");
    const confirmedMessage = await createMessage(
      session.token,
      queuedMessage.conversationId,
      queuedMessage.text,
      queuedMessage.clientMessageId
    );
    mergeIncomingMessage(confirmedMessage);
  });

  const sendQueuedMediaMessage = useEffectEvent(async (queuedMessage: PendingOutgoingMediaMessage) => {
    updatePendingMediaQueueItemStatus(queuedMessage.clientMessageId, "sending", queuedMessage.previewUrl);
    const blob = await getPendingMediaBlob(queuedMessage.clientMessageId);

    if (!blob) {
      throw new Error("Attachment data is unavailable locally.");
    }

    const file = new File([blob], queuedMessage.fileName, {
      type: queuedMessage.contentType || blob.type || "application/octet-stream"
    });
    const confirmedMessage = await uploadMessageMedia(
      session.token,
      queuedMessage.conversationId,
      file,
      queuedMessage.clientMessageId
    );
    mergeIncomingMessage(confirmedMessage);
  });

  const retryPendingMessages = useEffectEvent(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return;
    }

    for (const queuedMessage of pendingOutgoingQueueRef.current) {
      try {
        await sendQueuedTextMessage(queuedMessage);
      } catch {
        updatePendingQueueItemStatus(queuedMessage.clientMessageId, "failed");
      }
    }

    for (const queuedMessage of pendingOutgoingMediaQueueRef.current) {
      try {
        await sendQueuedMediaMessage(queuedMessage);
      } catch {
        updatePendingMediaQueueItemStatus(queuedMessage.clientMessageId, "failed", queuedMessage.previewUrl);
      }
    }
  });

  useEffect(() => {
    syncPendingQueueMessages(pendingOutgoingQueue);
  }, [currentUser.displayName, currentUser.id, pendingOutgoingQueue, syncPendingQueueMessages]);

  useEffect(() => {
    syncPendingMediaQueueMessages(pendingOutgoingMediaQueue);
  }, [currentUser.displayName, currentUser.id, pendingOutgoingMediaQueue, syncPendingMediaQueueMessages]);

  useEffect(() => {
    let disposed = false;

    async function hydratePendingMediaPreviews() {
      let didHydratePreview = false;
      const hydratedQueue = await Promise.all(
        pendingOutgoingMediaQueue.map(async (queuedMessage) => {
          if (queuedMessage.previewUrl) {
            return queuedMessage;
          }

          try {
            const blob = await getPendingMediaBlob(queuedMessage.clientMessageId);

            if (!blob) {
              return queuedMessage;
            }

            return {
              ...queuedMessage,
              previewUrl: URL.createObjectURL(blob)
            };
          } catch {
            return queuedMessage;
          }
        })
      );

      hydratedQueue.forEach((queuedMessage, index) => {
        if (!pendingOutgoingMediaQueue[index]?.previewUrl && queuedMessage.previewUrl) {
          didHydratePreview = true;
        }
      });

      if (!disposed && didHydratePreview) {
        setPendingOutgoingMediaQueue((current) =>
          current.map((queuedMessage) => {
            const hydrated = hydratedQueue.find((item) => item.clientMessageId === queuedMessage.clientMessageId);
            return hydrated ?? queuedMessage;
          })
        );
      }
    }

    void hydratePendingMediaPreviews();

    return () => {
      disposed = true;
    };
  }, [pendingOutgoingMediaQueue]);

  useEffect(() => {
    function handleBrowserOnline() {
      void retryPendingMessages();
    }

    window.addEventListener("online", handleBrowserOnline);
    return () => {
      window.removeEventListener("online", handleBrowserOnline);
    };
  }, [retryPendingMessages]);

  const syncConversationGroups = useEffectEvent(async () => {
    const connection = connectionRef.current;

    if (!connection || connection.state !== HubConnectionState.Connected) {
      return;
    }

    const nextConversationIds = new Set(conversations.map((conversation) => conversation.id));
    const joinedConversationIds = joinedConversationIdsRef.current;

    for (const joinedConversationId of Array.from(joinedConversationIds)) {
      if (!nextConversationIds.has(joinedConversationId)) {
        try {
          await connection.invoke("LeaveConversation", joinedConversationId.toString());
        } catch {
          return;
        }

        joinedConversationIds.delete(joinedConversationId);
      }
    }

    for (const conversationId of nextConversationIds) {
      if (joinedConversationIds.has(conversationId)) {
        continue;
      }

      try {
        await connection.invoke("JoinConversation", conversationId.toString());
        joinedConversationIds.add(conversationId);
      } catch (caughtError) {
        setWorkspaceError(
          caughtError instanceof Error ? caughtError.message : "Unable to join the conversation channel."
        );
        return;
      }
    }
  });

  useEffect(() => {
    let disposed = false;

    async function loadWorkspace() {
      try {
        setWorkspaceError("");
        const [user, fetchedContacts, fetchedConversations] = await Promise.all([
          getCurrentUser(session.token),
          getUsers(session.token),
          getConversations(session.token)
        ]);

        if (disposed) {
          return;
        }

        setCurrentUser(user);
        setContacts(fetchedContacts);
        setConversations(sortConversations(fetchedConversations));
        setActiveConversationId((current) => {
          if (requestedConversationId && fetchedConversations.some((conversation) => conversation.id === requestedConversationId)) {
            return requestedConversationId;
          }

          return current ?? fetchedConversations[0]?.id ?? null;
        });
        setStatus(fetchedConversations.length ? "Workspace synced." : "Pick a contact to start chatting.");
      } catch (caughtError) {
        if (disposed) {
          return;
        }

        const message = caughtError instanceof Error ? caughtError.message : "Unable to load workspace.";
        setWorkspaceError(message);

        if (message.toLowerCase().includes("401") || message.toLowerCase().includes("unauthorized")) {
          onSessionChange(null);
        }
      }
    }

    void loadWorkspace();

    return () => {
      disposed = true;
    };
  }, [onSessionChange, requestedConversationId, session.token]);

  useEffect(() => {
    let disposed = false;
    const connection = createChatConnection(session.token);
    connectionRef.current = connection;

    connection.on("ReceiveMessage", (message: Message) => {
      handleIncomingMessage(message);
    });

    connection.on("MessageReceiptsUpdated", (receipts: MessageReceipt[]) => {
      applyReceiptUpdates(receipts);
    });

    connection.on("MessageUpdated", (message: Message) => {
      applyMessagePatch(message);
    });

    connection.on("MessageDeleted", (message: Message) => {
      applyMessagePatch(message);
    });

    connection.on("TypingStarted", ({ conversationId, userId, displayName }: TypingPayload) => {
      if (userId === currentUser.id) {
        return;
      }

      setTypingByConversation((current) => ({
        ...current,
        [conversationId]: {
          userId,
          displayName: displayName ?? "Someone"
        }
      }));
      refreshIncomingTypingTimeout(conversationId);
    });

    connection.on("TypingStopped", ({ conversationId, userId }: TypingPayload) => {
      if (userId === currentUser.id) {
        return;
      }

      clearIncomingTyping(conversationId, userId);
    });

    connection.on("PresenceSnapshot", (userIds: string[]) => {
      setOnlineUserIds(new Set(userIds));
    });

    connection.on("PresenceChanged", ({ userId, isOnline }: PresenceChangedPayload) => {
      setOnlineUserIds((current) => {
        const next = new Set(current);

        if (isOnline) {
          next.add(userId);
        } else {
          next.delete(userId);
        }

        return next;
      });
    });

    connection.on("FriendshipChanged", ({ userId, friendshipStatus, friendshipRequestId }: FriendshipChangedPayload) => {
      setContacts((current) =>
        current.map((contact) =>
          contact.id === userId
            ? {
                ...contact,
                friendshipStatus,
                friendshipRequestId: friendshipRequestId ?? null
              }
            : contact
        )
      );
    });

    connection.on("ConversationCreated", (conversation: Conversation) => {
      setConversations((current) => upsertConversation(current, conversation));
      setActiveConversationId((current) =>
        requestedConversationId && requestedConversationId === conversation.id ? conversation.id : current ?? conversation.id
      );
      setStatus(`Conversation ready with ${conversation.displayName}.`);
    });

    connection.on("ConversationUpdated", (conversation: Conversation) => {
      setConversations((current) => upsertConversation(current, conversation));
    });

    connection.on("ConversationDeleted", ({ conversationId }: ConversationDeletedPayload) => {
      removeConversationLocally(conversationId);
      setStatus("Group removed.");
    });

    connection.onreconnecting(() => {
      setConnectionState("reconnecting");
    });

    connection.onreconnected(() => {
      joinedConversationIdsRef.current.clear();
      setConnectionState("online");
      setStatus("Realtime connection restored.");
      setWorkspaceError("");
      void syncConversationGroups();
      void retryPendingMessages();
    });

    connection.onclose(() => {
      joinedConversationIdsRef.current.clear();
      setConnectionState("offline");
      setOnlineUserIds(new Set());
      setTypingByConversation({});
      clearOutgoingTyping();
    });

    const startPromise = connection
      .start()
      .then(async () => {
        if (disposed) {
          return;
        }

        joinedConversationIdsRef.current.clear();
        setConnectionState("online");
        setWorkspaceError("");

        for (const conversation of conversationsRef.current) {
          try {
            await connection.invoke("JoinConversation", conversation.id.toString());
            joinedConversationIdsRef.current.add(conversation.id);
          } catch {
            // The hub auto-joins existing conversations; keep startup resilient.
          }
        }

        await syncConversationGroups();
      })
      .catch((caughtError) => {
        if (disposed) {
          return;
        }

        setConnectionState("offline");
        setStatus("Realtime connection unavailable. Falling back to HTTP messaging.");
        setWorkspaceError(
          caughtError instanceof Error ? caughtError.message : "Unable to establish realtime connection."
        );
      });

    return () => {
      disposed = true;
      connection.off("ReceiveMessage");
      connection.off("MessageReceiptsUpdated");
      connection.off("MessageUpdated");
      connection.off("MessageDeleted");
      connection.off("TypingStarted");
      connection.off("TypingStopped");
      connection.off("PresenceSnapshot");
      connection.off("PresenceChanged");
      connection.off("FriendshipChanged");
      connection.off("ConversationCreated");
      connection.off("ConversationUpdated");
      connection.off("ConversationDeleted");

      if (connectionRef.current === connection) {
        connectionRef.current = null;
      }

      joinedConversationIdsRef.current.clear();
      clearOutgoingTyping();
      Object.values(incomingTypingTimeoutsRef.current).forEach((timeout) => clearTimeout(timeout));
      incomingTypingTimeoutsRef.current = {};

      void startPromise.finally(async () => {
        if (connection.state !== HubConnectionState.Disconnected) {
          await connection.stop().catch(() => undefined);
        }
      });
    };
  }, [requestedConversationId, session.token]);

  useEffect(() => {
    if (!requestedConversationId) {
      return;
    }

    if (conversations.some((conversation) => conversation.id === requestedConversationId)) {
      setActiveConversationId(requestedConversationId);
    }
  }, [conversations, requestedConversationId]);

  useEffect(() => {
    if (!activeConversationId) {
      return;
    }

    setUnreadCounts((current) => {
      if (!current[activeConversationId]) {
        return current;
      }

      const next = { ...current };
      delete next[activeConversationId];
      return next;
    });

    const conversationId = activeConversationId;
    let disposed = false;

    async function loadConversationMessages() {
        try {
          const conversationMessages = await getMessages(session.token, conversationId);
          const queuedMessages = pendingOutgoingQueueRef.current
            .filter((queuedMessage) => queuedMessage.conversationId === conversationId)
            .map((queuedMessage) => createPendingTextMessage(queuedMessage));
          const queuedMediaMessages = pendingOutgoingMediaQueueRef.current
            .filter((queuedMessage) => queuedMessage.conversationId === conversationId)
            .map((queuedMessage) => createPendingMediaMessage(queuedMessage));
          const mergedConversationMessages = [...conversationMessages];

          for (const queuedMessage of queuedMessages) {
            if (!mergedConversationMessages.some((message) => message.clientMessageId === queuedMessage.clientMessageId)) {
              mergedConversationMessages.push(queuedMessage);
            }
          }

          for (const queuedMessage of queuedMediaMessages) {
            if (!mergedConversationMessages.some((message) => message.clientMessageId === queuedMessage.clientMessageId)) {
              mergedConversationMessages.push(queuedMessage);
            }
          }

          if (!disposed) {
            setMessagesByConversation((current) => ({
              ...current,
              [conversationId]: mergedConversationMessages
            }));

            void acknowledgeConversationRead(conversationId, mergedConversationMessages);
          }
        } catch (caughtError) {
        if (!disposed) {
          setWorkspaceError(caughtError instanceof Error ? caughtError.message : "Unable to load messages.");
        }
      }
    }

    void loadConversationMessages();

    return () => {
      disposed = true;
    };
  }, [activeConversationId, session.token]);

  useEffect(() => {
    if (connectionState !== "online") {
      return;
    }

    void syncConversationGroups();
    void retryPendingMessages();
  }, [connectionState, conversations, retryPendingMessages]);

  useEffect(() => {
    const typingConversationId = outgoingTypingConversationIdRef.current;

    if (typingConversationId && typingConversationId !== activeConversationId) {
      clearOutgoingTyping(typingConversationId);
    }
  }, [activeConversationId]);

  useEffect(() => {
    const messageStream = messageStreamRef.current;

    if (!messageStream) {
      return;
    }

    messageStream.scrollTo({
      top: messageStream.scrollHeight,
      behavior: "smooth"
    });
  }, [activeConversationId, messages]);

  function removeConversationLocally(conversationId: number) {
    setConversations((current) => current.filter((conversation) => conversation.id !== conversationId));
    setMessagesByConversation((current) => {
      if (!(conversationId in current)) {
        return current;
      }

      const next = { ...current };
      delete next[conversationId];
      return next;
    });
    setUnreadCounts((current) => {
      if (!(conversationId in current)) {
        return current;
      }

      const next = { ...current };
      delete next[conversationId];
      return next;
    });
    setTypingByConversation((current) => {
      if (!(conversationId in current)) {
        return current;
      }

      const next = { ...current };
      delete next[conversationId];
      return next;
    });
    setActiveConversationId((current) => (current === conversationId ? null : current));
    setIsGroupSettingsOpen(false);
  }

  function handleSelectConversation(conversationId: number) {
    const selectedConversation = conversations.find((conversation) => conversation.id === conversationId);
    setActiveConversationId(conversationId);

    if (selectedConversation) {
      setStatus(`Opened ${selectedConversation.displayName}.`);
    }
  }

  function openCreateGroupModal() {
    setSidebarView("friends");
    setIsCreateGroupOpen(true);
    setGroupForm(createInitialGroupForm());
    setGroupFormError("");
  }

  function closeCreateGroupModal() {
    setIsCreateGroupOpen(false);
    setGroupForm(createInitialGroupForm());
    setGroupFormError("");
  }

  function handleToggleGroupParticipant(participantId: string) {
    setGroupForm((current) => ({
      ...current,
      participantIds: current.participantIds.includes(participantId)
        ? current.participantIds.filter((id) => id !== participantId)
        : [...current.participantIds, participantId]
    }));
  }

  function handleGroupFormChange(field: keyof CreateGroupFormState, value: string | boolean) {
    setGroupForm((current) => ({
      ...current,
      [field]: value
    } as CreateGroupFormState));
  }

  function openGroupSettingsModal() {
    if (!activeConversation?.isGroup) {
      return;
    }

    setIsGroupSettingsOpen(true);
    setGroupSettingsForm(createGroupSettingsForm(activeConversation));
    setGroupSettingsSelectedParticipantIds([]);
    setGroupSettingsError("");
    setGroupSettingsStatus("");
  }

  function closeGroupSettingsModal() {
    setIsGroupSettingsOpen(false);
    setGroupSettingsSelectedParticipantIds([]);
    setGroupSettingsError("");
    setGroupSettingsStatus("");
  }

  function handleGroupSettingsFieldChange(field: keyof UpdateGroupSettingsRequest, value: string) {
    setGroupSettingsForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function handleGroupSettingsImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setGroupSettingsForm((current) => ({
        ...current,
        groupImageUrl: typeof reader.result === "string" ? reader.result : current.groupImageUrl
      }));
    };
    reader.readAsDataURL(file);
  }

  function handleToggleGroupSettingsParticipant(participantId: string) {
    setGroupSettingsSelectedParticipantIds((current) =>
      current.includes(participantId) ? current.filter((id) => id !== participantId) : [...current, participantId]
    );
  }

  function applyConversationUpdate(conversation: Conversation) {
    setConversations((current) => upsertConversation(current, conversation));
    setStatus(`${conversation.displayName} updated.`);
  }

  function handleSaveGroupSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeGroupConversation) {
      return;
    }

    const trimmedGroupName = groupSettingsForm.groupName.trim();

    if (!trimmedGroupName) {
      setGroupSettingsError("Group name is required.");
      return;
    }

    setGroupSettingsError("");
    setGroupSettingsStatus("");

    startGroupSettingsTransition(async () => {
      try {
        const updatedConversation = await updateGroupSettings(session.token, activeGroupConversation.id, {
          groupName: trimmedGroupName,
          groupImageUrl: groupSettingsForm.groupImageUrl?.trim() ?? "",
          groupRules: groupSettingsForm.groupRules?.trim() ?? ""
        });

        applyConversationUpdate(updatedConversation);
        setGroupSettingsForm(createGroupSettingsForm(updatedConversation));
        setGroupSettingsStatus("Group settings saved.");
      } catch (caughtError) {
        setGroupSettingsError(caughtError instanceof Error ? caughtError.message : "Unable to save group settings.");
      }
    });
  }

  function handleAddSelectedGroupParticipants() {
    if (!activeGroupConversation) {
      return;
    }

    if (!groupSettingsSelectedParticipantIds.length) {
      setGroupSettingsError("Select at least one person to add.");
      return;
    }

    setGroupSettingsError("");
    setGroupSettingsStatus("");

    startGroupSettingsTransition(async () => {
      try {
        const updatedConversation = await addGroupParticipants(session.token, activeGroupConversation.id, {
          participantIds: groupSettingsSelectedParticipantIds
        });

        applyConversationUpdate(updatedConversation);
        setGroupSettingsForm(createGroupSettingsForm(updatedConversation));
        setGroupSettingsSelectedParticipantIds([]);
        setGroupSettingsStatus("People added to the group.");
      } catch (caughtError) {
        setGroupSettingsError(caughtError instanceof Error ? caughtError.message : "Unable to add people to the group.");
      }
    });
  }

  function handleRemoveGroupMember(participantId: string) {
    if (!activeGroupConversation) {
      return;
    }

    startGroupSettingsTransition(async () => {
      try {
        const updatedConversation = await removeGroupParticipant(session.token, activeGroupConversation.id, participantId);

        applyConversationUpdate(updatedConversation);
        setGroupSettingsForm(createGroupSettingsForm(updatedConversation));
        setGroupSettingsStatus("Person removed from the group.");
      } catch (caughtError) {
        setGroupSettingsError(caughtError instanceof Error ? caughtError.message : "Unable to remove that person.");
      }
    });
  }

  async function handleCreateGroupConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGroupFormError("");

    const trimmedGroupName = groupForm.groupName.trim();

    if (!trimmedGroupName) {
      setGroupFormError("Group name is required.");
      return;
    }

    if (groupForm.participantIds.length < 2) {
      setGroupFormError("Select at least two people for a group chat.");
      return;
    }

    const expiresInHours = getExpiresInHours(groupForm);

    if (groupForm.isTemporary && (!Number.isFinite(expiresInHours) || !expiresInHours)) {
      setGroupFormError("Enter a valid expiry in hours or days.");
      return;
    }

    startCreateGroupTransition(async () => {
      try {
        const conversation = await createGroupConversation(session.token, {
          participantIds: groupForm.participantIds,
          groupName: trimmedGroupName,
          isTemporary: groupForm.isTemporary,
          expiresInHours
        });

        setConversations((current) => upsertConversation(current, conversation));
        setActiveConversationId(conversation.id);
        setStatus(`Group room ${conversation.displayName} created.`);
        closeCreateGroupModal();
      } catch (caughtError) {
        setGroupFormError(caughtError instanceof Error ? caughtError.message : "Unable to create group room.");
      }
    });
  }

  async function handleDeleteConversation() {
    if (!activeConversation?.isGroup) {
      return;
    }

    await deleteConversation(session.token, activeConversation.id);
    removeConversationLocally(activeConversation.id);
    setStatus(`${activeConversation.displayName} deleted.`);
  }

  async function handleSelectContact(contact: AuthUser) {
    try {
      const existingConversation = conversationByUserId.get(contact.id);

      if (existingConversation) {
        setActiveConversationId(existingConversation.id);
        setStatus(`Opened chat with ${contact.displayName}.`);
        return;
      }

      const conversation = await createConversation(session.token, [contact.id]);
      setConversations((current) => upsertConversation(current, conversation));
      setActiveConversationId(conversation.id);
      setStatus(`Conversation ready with ${contact.displayName}.`);
    } catch (caughtError) {
      setWorkspaceError(caughtError instanceof Error ? caughtError.message : "Unable to create conversation.");
    }
  }

  function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeConversationId || !draft.trim()) {
      return;
    }

    const text = draft.trim();
    const queuedMessage: PendingOutgoingTextMessage = {
      tempId: nextTempMessageIdRef.current,
      clientMessageId: crypto.randomUUID(),
      conversationId: activeConversationId,
      text,
      createdAt: new Date().toISOString(),
      status: "sending"
    };

    nextTempMessageIdRef.current -= 1;
    setDraft("");
    clearOutgoingTyping(activeConversationId);
    setPendingOutgoingQueue((current) => [...current, queuedMessage]);
    mergeIncomingMessage(createPendingTextMessage(queuedMessage));

    startSendTransition(async () => {
      try {
        await sendQueuedTextMessage(queuedMessage);
        setWorkspaceError("");
      } catch (caughtError) {
        updatePendingQueueItemStatus(queuedMessage.clientMessageId, "failed");
        setWorkspaceError(
          caughtError instanceof Error ? caughtError.message : "Message queued. It will retry when you are back online."
        );
      }
    });
  }

  async function handleSendFriendRequest(recipientId: string) {
    try {
      await sendFriendRequest(session.token, recipientId);
      await refreshContacts();
      setStatus("Friend request sent.");
    } catch (caughtError) {
      setWorkspaceError(caughtError instanceof Error ? caughtError.message : "Unable to send friend request.");
    }
  }

  async function handleAcceptFriendRequest(requestId: number) {
    try {
      await acceptFriendRequest(session.token, requestId);
      await refreshContacts();
      setStatus("Friend request accepted.");
    } catch (caughtError) {
      setWorkspaceError(caughtError instanceof Error ? caughtError.message : "Unable to accept friend request.");
    }
  }

  async function handleDeclineFriendRequest(requestId: number) {
    try {
      await declineFriendRequest(session.token, requestId);
      await refreshContacts();
      setStatus("Friend request declined.");
    } catch (caughtError) {
      setWorkspaceError(caughtError instanceof Error ? caughtError.message : "Unable to decline friend request.");
    }
  }

  async function handleUpdateMessage(messageId: number, text: string) {
    const updated = await updateMessage(session.token, messageId, text);
    applyMessagePatch(updated);
  }

  async function handleDeleteMessage(messageId: number) {
    const deleted = await deleteMessage(session.token, messageId);
    applyMessagePatch(deleted);
  }

  function handleUploadMedia(file: File) {
    if (!activeConversationId) {
      return;
    }

    const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
    const queuedMessage: PendingOutgoingMediaMessage = {
      tempId: nextTempMessageIdRef.current,
      clientMessageId: crypto.randomUUID(),
      conversationId: activeConversationId,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      fileSize: file.size,
      createdAt: new Date().toISOString(),
      status: "sending",
      previewUrl
    };

    nextTempMessageIdRef.current -= 1;
    setPendingOutgoingMediaQueue((current) => [...current, queuedMessage]);
    mergeIncomingMessage(createPendingMediaMessage(queuedMessage));

    startUploadTransition(async () => {
      try {
        await savePendingMediaBlob(queuedMessage.clientMessageId, file);
        await sendQueuedMediaMessage(queuedMessage);
        setStatus(file.type.startsWith("image/") ? "Photo sent." : "File sent.");
        setWorkspaceError("");
      } catch (caughtError) {
        updatePendingMediaQueueItemStatus(queuedMessage.clientMessageId, "failed", previewUrl);
        setWorkspaceError(
          caughtError instanceof Error ? caughtError.message : "Attachment queued. It will retry when you are back online."
        );
      }
    });
  }

  async function handleRetryMessage(clientMessageId: string) {
    const queuedMessage = pendingOutgoingQueueRef.current.find((message) => message.clientMessageId === clientMessageId);

    if (queuedMessage) {
      try {
        await sendQueuedTextMessage(queuedMessage);
        setWorkspaceError("");
      } catch (caughtError) {
        updatePendingQueueItemStatus(clientMessageId, "failed");
        setWorkspaceError(caughtError instanceof Error ? caughtError.message : "Unable to retry message.");
      }

      return;
    }

    const queuedMediaMessage = pendingOutgoingMediaQueueRef.current.find((message) => message.clientMessageId === clientMessageId);

    if (!queuedMediaMessage) {
      return;
    }

    try {
      await sendQueuedMediaMessage(queuedMediaMessage);
      setWorkspaceError("");
    } catch (caughtError) {
      updatePendingMediaQueueItemStatus(clientMessageId, "failed", queuedMediaMessage.previewUrl);
      setWorkspaceError(caughtError instanceof Error ? caughtError.message : "Unable to retry attachment.");
    }
  }

  function getFriendshipLabel(contact: AuthUser) {
    switch (contact.friendshipStatus) {
      case "friends":
        return "Friend";
      case "incoming":
        return "Sent you a request";
      case "outgoing":
        return "Request sent";
      default:
        return null;
    }
  }

  function openProfilePanel(editMode = false) {
    setIsCreateGroupOpen(false);
    setSidebarView("profile");
    setProfileError("");
    setProfileStatus("");
    setIsEditingProfile(editMode);
    setProfileForm(createProfileForm(currentUser));
  }

  function handleShowFriends() {
    setIsCreateGroupOpen(false);
    setSidebarView("friends");
    setIsEditingProfile(false);
  }

  function handleShowRequests() {
    setIsCreateGroupOpen(false);
    setSidebarView("requests");
    setIsEditingProfile(false);
  }

  function handleShowDiscover() {
    setIsCreateGroupOpen(false);
    setSidebarView("discover");
    setIsEditingProfile(false);
  }

  function openSettingsHome() {
    setIsCreateGroupOpen(false);
    setSidebarView("settings");
    setSettingsScreen("home");
    setSettingsSearch("");
    setProfileError("");
    setProfileStatus("");
    setChatSettingsError("");
    setChatSettingsStatus("");
    setIsThemeDialogOpen(false);
    setChatThemeDraft(chatThemePreference);
    setChatWallpaperDraft(chatWallpaperPreference);
  }

  function openSettingsProfile() {
    setIsCreateGroupOpen(false);
    setSidebarView("settings");
    setSettingsScreen("profile");
    setProfileError("");
    setProfileStatus("");
    setProfileForm(createProfileForm(currentUser));
    setChatSettingsError("");
    setChatSettingsStatus("");
  }

  function openChatSettings() {
    setIsCreateGroupOpen(false);
    setSidebarView("settings");
    setSettingsScreen("chats");
    setChatSettingsError("");
    setChatSettingsStatus("");
    setIsThemeDialogOpen(false);
    setChatThemeDraft(chatThemePreference);
    setChatWallpaperDraft(chatWallpaperPreference);
  }

  function handleProfileFieldChange(field: keyof UpdateProfileRequest, value: string) {
    setProfileForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function handleCancelProfileEdit() {
    setIsEditingProfile(false);
    setProfileError("");
    setProfileStatus("");
    setProfileForm(createProfileForm(currentUser));
    setChatSettingsError("");
    setChatSettingsStatus("");
  }

  function handleProfileImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setProfileForm((current) => ({
        ...current,
        profileImageUrl: typeof reader.result === "string" ? reader.result : current.profileImageUrl
      }));
    };
    reader.readAsDataURL(file);
  }

  function handleOpenThemeDialog() {
    setChatThemeDraft(chatThemePreference);
    setIsThemeDialogOpen(true);
  }

  function handleCloseThemeDialog() {
    setChatThemeDraft(chatThemePreference);
    setIsThemeDialogOpen(false);
  }

  function handleConfirmThemeDialog() {
    setChatThemePreference(chatThemeDraft);
    setIsThemeDialogOpen(false);
  }

  function handlePreviewWallpaper(wallpaper: ChatWallpaperPreference) {
    setChatWallpaperDraft(wallpaper);
  }

  function handleDiscardWallpaperPreview() {
    setChatWallpaperDraft(chatWallpaperPreference);
  }

  function handleSaveChatSettings() {
    setChatSettingsError("");
    setChatSettingsStatus("");

    startChatSettingsTransition(async () => {
      try {
        const updatedUser = await updateCurrentUser(session.token, {
          ...createProfileForm(currentUser),
          chatThemePreference,
          chatWallpaperPreference: chatWallpaperDraft
        });

        setCurrentUser(updatedUser);
        onSessionChange({
          ...session,
          user: updatedUser
        });
        setChatThemePreference(updatedUser.chatThemePreference ?? "system");
        setChatWallpaperPreference(updatedUser.chatWallpaperPreference ?? "default");
        setChatThemeDraft(updatedUser.chatThemePreference ?? "system");
        setChatWallpaperDraft(updatedUser.chatWallpaperPreference ?? "default");
        setChatSettingsStatus("Chat appearance updated.");
      } catch (caughtError) {
        setChatSettingsError(caughtError instanceof Error ? caughtError.message : "Unable to save chat settings.");
      }
    });
  }
  function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError("");
    setProfileStatus("");

    startProfileTransition(async () => {
      try {
        const updatedUser = await updateCurrentUser(session.token, profileForm);
        setCurrentUser(updatedUser);
        onSessionChange({
          ...session,
          user: updatedUser
        });
        setIsEditingProfile(false);
        setProfileStatus("Profile updated.");
      } catch (caughtError) {
        setProfileError(caughtError instanceof Error ? caughtError.message : "Unable to update profile.");
      }
    });
  }

  return (
    <main className={`workspace-shell chat-theme-${appliedChatTheme} chat-wallpaper-${effectiveWallpaperPreference}`}>
      <section className={`workspace-frame ${activeConversation ? "mobile-chat-open" : "mobile-sidebar-open"}`}>
        <aside className={`sidebar-shell ${sidebarView === "profile" || sidebarView === "settings" ? "profile-open" : ""}`}>
          <SidebarRail
            currentUser={currentUser}
            sidebarView={sidebarView}
            requestCount={incomingRequestContacts.length}
            discoverCount={discoverContacts.length}
            onShowFriends={handleShowFriends}
            onShowRequests={handleShowRequests}
            onShowDiscover={handleShowDiscover}
            onShowProfile={() => openProfilePanel(false)}
            onShowSettings={openSettingsHome}
            onLogout={() => onSessionChange(null)}
          />

          <div className="sidebar">
            {sidebarView === "profile" ? (
              <ProfileSidebar
                currentUser={currentUser}
                isEditingProfile={isEditingProfile}
                profileForm={profileForm}
                profileError={profileError}
                profileStatus={profileStatus}
                isSavingProfile={isSavingProfile}
                onShowPeople={handleShowFriends}
                onStartEdit={() => setIsEditingProfile(true)}
                onCancelEdit={handleCancelProfileEdit}
                onLogout={() => onSessionChange(null)}
                onProfileFieldChange={handleProfileFieldChange}
                onProfileImageUpload={handleProfileImageUpload}
                onSaveProfile={handleSaveProfile}
              />
            ) : sidebarView === "settings" ? (
              settingsScreen === "profile" ? (
                <ProfileSettingsPanel
                  currentUser={currentUser}
                  profileForm={profileForm}
                  profileError={profileError}
                  profileStatus={profileStatus}
                  isSavingProfile={isSavingProfile}
                  onBack={openSettingsHome}
                  onProfileFieldChange={handleProfileFieldChange}
                  onProfileImageUpload={handleProfileImageUpload}
                  onSaveProfile={handleSaveProfile}
                />
              ) : settingsScreen === "chats" ? (
                <ChatSettingsPanel
                  savedThemePreference={chatThemePreference}
                  draftThemePreference={chatThemeDraft}
                  appliedTheme={appliedChatTheme}
                  savedWallpaperPreference={chatWallpaperPreference}
                  draftWallpaperPreference={chatWallpaperDraft}
                  isThemeDialogOpen={isThemeDialogOpen}
                  isSaving={isSavingChatSettings}
                  error={chatSettingsError}
                  status={chatSettingsStatus}
                  onBack={openSettingsHome}
                  onOpenThemeDialog={handleOpenThemeDialog}
                  onCloseThemeDialog={handleCloseThemeDialog}
                  onThemeDraftChange={setChatThemeDraft}
                  onConfirmThemeDialog={handleConfirmThemeDialog}
                  onPreviewWallpaper={handlePreviewWallpaper}
                  onDiscardWallpaperPreview={handleDiscardWallpaperPreview}
                  onSaveWallpaper={handleSaveChatSettings}
                />
              ) : (
                <SettingsSidebar
                  currentUser={currentUser}
                  search={settingsSearch}
                  onSearchChange={setSettingsSearch}
                  onOpenProfileSettings={openSettingsProfile}
                  onOpenChatSettings={openChatSettings}
                />
              )
            ) : (
              <PeopleSidebar
                mode={sidebarView as "friends" | "requests" | "discover"}
                search={search}
                notificationPermission={notificationPermission}
                onSearchChange={setSearch}
                incomingRequestContacts={incomingRequestContacts}
                friendContacts={friendContacts}
                discoverContacts={discoverContacts}
                groupConversations={groupConversations}
                conversationByUserId={conversationByUserId}
                activeConversationId={activeConversationId}
                unreadCounts={unreadCounts}
                onlineUserIds={onlineUserIds}
                onSelectContact={handleSelectContact}
                onSelectConversation={handleSelectConversation}
                onOpenCreateGroup={openCreateGroupModal}
                onAcceptFriendRequest={handleAcceptFriendRequest}
                onDeclineFriendRequest={handleDeclineFriendRequest}
                onSendFriendRequest={handleSendFriendRequest}
                getFriendshipLabel={getFriendshipLabel}
              />
            )}
          </div>
        </aside>

        <ChatPanel
          activeConversation={activeConversation}
          activeConversationPresence={activeConversationPresence}
          activeDirectContact={activeDirectContact}
          currentUser={currentUser}
          messages={messages}
          messageStreamRef={messageStreamRef}
          draft={draft}
          isSending={isSending}
          isUploadingMedia={isUploadingMedia}
          onDraftChange={handleDraftChange}
          onSendMessage={handleSendMessage}
          onUploadMedia={handleUploadMedia}
          onUpdateMessage={handleUpdateMessage}
          onDeleteMessage={handleDeleteMessage}
          onDeleteConversation={handleDeleteConversation}
          onOpenGroupSettings={openGroupSettingsModal}
          onRetryMessage={handleRetryMessage}
          onSendFriendRequest={handleSendFriendRequest}
          onAcceptFriendRequest={handleAcceptFriendRequest}
          onDeclineFriendRequest={handleDeclineFriendRequest}
          onMobileBack={() => setActiveConversationId(null)}
        />

        {isCreateGroupOpen ? (
          <div className="group-modal-backdrop" role="presentation" onClick={closeCreateGroupModal}>
            <div
              aria-labelledby="group-modal-title"
              aria-modal="true"
              className="group-modal"
              role="dialog"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="group-modal-header">
                <div>
                  <p className="eyebrow">Group room</p>
                  <h3 id="group-modal-title">Create a new group</h3>
                </div>
                <button className="ghost-button" type="button" onClick={closeCreateGroupModal}>
                  Close
                </button>
              </div>

              <form className="group-modal-form" onSubmit={handleCreateGroupConversation}>
                <label>
                  <span>Group name</span>
                  <input
                    maxLength={60}
                    placeholder="Weekend squad"
                    required
                    value={groupForm.groupName}
                    onChange={(event) => handleGroupFormChange("groupName", event.target.value)}
                  />
                </label>

                <div className="group-modal-options">
                  <label className="group-toggle-row">
                    <input
                      checked={groupForm.isTemporary}
                      type="checkbox"
                      onChange={(event) => handleGroupFormChange("isTemporary", event.target.checked)}
                    />
                    <span>
                      <strong>Temporary room</strong>
                      <small>Auto-delete after the admin-chosen time.</small>
                    </span>
                  </label>

                  {groupForm.isTemporary ? (
                    <div className="group-expiry-row">
                      <label>
                        <span>Delete after</span>
                        <input
                          inputMode="numeric"
                          placeholder="24"
                          value={groupForm.expiresValue}
                          onChange={(event) => handleGroupFormChange("expiresValue", event.target.value)}
                        />
                      </label>
                      <label>
                        <span>Unit</span>
                        <select
                          value={groupForm.expiresUnit}
                          onChange={(event) => handleGroupFormChange("expiresUnit", event.target.value as GroupExpiryUnit)}
                        >
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                        </select>
                      </label>
                    </div>
                  ) : (
                    <p className="group-modal-helper">Permanent groups stay until the admin deletes them.</p>
                  )}
                </div>

                <div className="group-modal-members">
                  <div className="section-heading inner">
                    <span>Choose people</span>
                    <span>{groupForm.participantIds.length} selected</span>
                  </div>
                  <div className="group-member-list">
                    {groupCandidates.map((contact) => {
                      const isSelected = groupForm.participantIds.includes(contact.id);
                      const isOnline = onlineUserIds.has(contact.id);
                      const profileImageUrl = resolveMediaUrl(contact.profileImageUrl);

                      return (
                        <label key={contact.id} className={`group-member-card ${isSelected ? "selected" : ""}`}>
                          <input checked={isSelected} type="checkbox" onChange={() => handleToggleGroupParticipant(contact.id)} />
                          <span className={`avatar-badge ${isOnline ? "live" : ""}`}>
                            {profileImageUrl ? (
                              <img alt={contact.displayName} className="avatar-image" src={profileImageUrl} />
                            ) : (
                              contact.displayName
                                .split(" ")
                                .map((part) => part[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()
                            )}
                            <span className={`presence-dot ${isOnline ? "online" : ""}`} />
                          </span>
                          <span className="group-member-copy">
                            <strong>{contact.displayName}</strong>
                            <small>{contact.email}</small>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {groupFormError ? <p className="status-banner error">{groupFormError}</p> : null}

                <div className="group-modal-actions">
                  <button className="ghost-button" type="button" onClick={closeCreateGroupModal}>
                    Cancel
                  </button>
                  <button className="primary-button" disabled={isCreatingGroup} type="submit">
                    {isCreatingGroup ? "Creating..." : "Create group"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {isGroupSettingsOpen && activeGroupConversation ? (
          <GroupSettingsModal
            conversation={activeGroupConversation}
            availableContacts={availableGroupContacts}
            selectedParticipantIds={groupSettingsSelectedParticipantIds}
            form={groupSettingsForm}
            error={groupSettingsError}
            status={groupSettingsStatus}
            isSaving={isSavingGroupSettings}
            canManage={canManageActiveGroup}
            onlineUserIds={onlineUserIds}
            onClose={closeGroupSettingsModal}
            onFormChange={handleGroupSettingsFieldChange}
            onGroupImageUpload={handleGroupSettingsImageUpload}
            onToggleParticipant={handleToggleGroupSettingsParticipant}
            onSave={handleSaveGroupSettings}
            onAddParticipants={handleAddSelectedGroupParticipants}
            onRemoveParticipant={handleRemoveGroupMember}
          />
        ) : null}
      </section>
    </main>
  );
}

export default ChatView;

































