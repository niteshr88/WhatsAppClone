import { Fragment, useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, RefObject } from "react";
import { resolveMediaUrl } from "../../api";
import type { AuthUser, Conversation, Message } from "../../types";
import { formatFileSize, formatMessageTime, initials } from "../../utils/chat";

type ActiveConversationPresence = {
  isOnline: boolean;
  subtitle: string;
};

type ChatPanelProps = {
  activeConversation: Conversation | null;
  activeConversationPresence: ActiveConversationPresence;
  activeDirectContact: AuthUser | null;
  currentUser: AuthUser;
  messages: Message[];
  messageStreamRef: RefObject<HTMLDivElement | null>;
  draft: string;
  isSending: boolean;
  isUploadingMedia: boolean;
  onDraftChange: (value: string) => void;
  onSendMessage: (event: FormEvent<HTMLFormElement>) => void;
  onUploadMedia: (file: File) => void | Promise<void>;
  onUpdateMessage: (messageId: number, text: string) => Promise<void>;
  onDeleteMessage: (messageId: number) => Promise<void>;
  onRetryMessage: (clientMessageId: string) => void | Promise<void>;
  onSendFriendRequest: (recipientId: string) => void | Promise<void>;
  onAcceptFriendRequest: (requestId: number) => void | Promise<void>;
  onDeclineFriendRequest: (requestId: number) => void | Promise<void>;
  onMobileBack: () => void;
};

const QUICK_EMOJIS = ["😀", "😂", "😍", "🔥", "👍", "🙏", "🎉", "❤️"];

function MessageTickIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 16 16">
      <path
        d="M3.5 8.7 6.1 11.3 12.5 4.9"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <path
        d="M4.5 11.6 18.9 5.6c.7-.3 1.3.4 1 1l-6 14.4c-.3.8-1.5.7-1.7-.1l-1.6-6-6-1.6c-.8-.2-.9-1.4-.1-1.7Z"
        fill="currentColor"
      />
    </svg>
  );
}

function AttachmentIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <path
        d="M12 5.5v13M5.5 12h13"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function CaretDownIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 16 16">
      <path
        d="M3.5 6.2 8 10.7l4.5-4.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 20 20">
      <path
        d="M12.5 4.5 7 10l5.5 5.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function MoreVerticalIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 20 20">
      <circle cx="10" cy="4.5" r="1.5" fill="currentColor" />
      <circle cx="10" cy="10" r="1.5" fill="currentColor" />
      <circle cx="10" cy="15.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

function EmojiIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
      <path
        d="M8.5 14.2c.9 1.3 2.1 1.9 3.5 1.9s2.6-.6 3.5-1.9"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function PendingClockIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.9v3.4l2.4 1.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

function FailedMessageIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6" fill="currentColor" opacity="0.14" />
      <path d="M8 4.1v4.4M8 11.5h.01" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

const EMOJI_GROUPS = [
  {
    id: "people",
    icon: "\u{1F603}",
    label: "Smileys & People",
    emojis: [
      "\u{1F600}", "\u{1F603}", "\u{1F604}", "\u{1F601}", "\u{1F606}", "\u{1F605}", "\u{1F923}", "\u{1F602}",
      "\u{1F642}", "\u{1F643}", "\u{1F609}", "\u{1F60A}", "\u{1F60D}", "\u{1F970}", "\u{1F618}", "\u{1F61A}",
      "\u{1F61B}", "\u{1F61C}", "\u{1F92A}", "\u{1F973}", "\u{1F60E}", "\u{1F913}", "\u{1F914}", "\u{1F92D}",
      "\u{1F92B}", "\u{1F971}", "\u{1F62E}", "\u{1F62F}", "\u{1F632}", "\u{1F97A}", "\u{1F622}", "\u{1F621}"
    ]
  },
  {
    id: "gestures",
    icon: "\u{1F44D}",
    label: "Gestures",
    emojis: [
      "\u{1F44D}", "\u{1F44E}", "\u{1F44F}", "\u{1F64C}", "\u{1F64F}", "\u{1F91D}", "\u{270C}\u{FE0F}", "\u{1F90C}",
      "\u{1F44C}", "\u{1F44B}", "\u{1F91F}", "\u{1F918}", "\u{1F919}", "\u{1F596}", "\u{270A}", "\u{1F44A}",
      "\u{1F90F}", "\u{1F91A}", "\u{1F448}", "\u{1F449}", "\u{1F446}", "\u{1F447}", "\u{1F4AA}", "\u{1F525}"
    ]
  },
  {
    id: "hearts",
    icon: "\u{2764}\u{FE0F}",
    label: "Hearts",
    emojis: [
      "\u{2764}\u{FE0F}", "\u{1F9E1}", "\u{1F49B}", "\u{1F49A}", "\u{1F499}", "\u{1F49C}", "\u{1F90E}", "\u{1F5A4}",
      "\u{1F497}", "\u{1F493}", "\u{1F495}", "\u{1F496}", "\u{1F498}", "\u{1F49D}", "\u{1F49E}", "\u{1F49F}",
      "\u{1F48C}", "\u{1F49D}", "\u{1FA77}", "\u{1F48B}", "\u{1F970}", "\u{1F60D}", "\u{1F618}", "\u{1F929}"
    ]
  },
  {
    id: "celebration",
    icon: "\u{1F389}",
    label: "Celebration",
    emojis: [
      "\u{1F389}", "\u{1F38A}", "\u{1F973}", "\u{1F37E}", "\u{1F380}", "\u{1F381}", "\u{1F382}", "\u{1F36D}",
      "\u{1F3C6}", "\u{1F3C5}", "\u{1F31F}", "\u{2728}", "\u{1F4AF}", "\u{1F525}", "\u{1F680}", "\u{1F31E}"
    ]
  }
] as const;

const STICKER_PACKS = [
  { id: "hey", label: "Hey", assetPath: "/stickers/hey.svg" },
  { id: "wow", label: "Wow", assetPath: "/stickers/wow.svg" },
  { id: "cool", label: "Cool", assetPath: "/stickers/cool.svg" },
  { id: "party", label: "Party", assetPath: "/stickers/party.svg" }
] as const;

function ChatPanel({
  activeConversation,
  activeConversationPresence,
  activeDirectContact,
  currentUser,
  messages,
  messageStreamRef,
  draft,
  isSending,
  isUploadingMedia,
  onDraftChange,
  onSendMessage,
  onUploadMedia,
  onUpdateMessage,
  onDeleteMessage,
  onRetryMessage,
  onSendFriendRequest,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  onMobileBack
}: ChatPanelProps) {
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [messageActionError, setMessageActionError] = useState("");
  const [pendingMessageId, setPendingMessageId] = useState<number | null>(null);
  const [openMenuMessageId, setOpenMenuMessageId] = useState<number | null>(null);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isExpressionMenuOpen, setIsExpressionMenuOpen] = useState(false);
  const [expressionTab, setExpressionTab] = useState<"emoji" | "stickers" | "uploads">("emoji");
  const [activeEmojiCategory, setActiveEmojiCategory] = useState<(typeof EMOJI_GROUPS)[number]["id"]>("people");
  const [emojiSearch, setEmojiSearch] = useState("");
  const openMenuRef = useRef<HTMLDivElement | null>(null);
  const headerMenuRef = useRef<HTMLDivElement | null>(null);
  const attachmentMenuRef = useRef<HTMLDivElement | null>(null);
  const expressionMenuRef = useRef<HTMLDivElement | null>(null);
  const composerDocumentInputRef = useRef<HTMLInputElement | null>(null);
  const composerMediaInputRef = useRef<HTMLInputElement | null>(null);
  const composerStickerInputRef = useRef<HTMLInputElement | null>(null);
  const composerGifInputRef = useRef<HTMLInputElement | null>(null);
  const normalizedEmojiSearch = emojiSearch.trim().toLowerCase();
  const emojiGroupsToRender = normalizedEmojiSearch
    ? EMOJI_GROUPS.map((group) => ({
        ...group,
        emojis: group.emojis.filter((emoji) => emoji.toLowerCase().includes(normalizedEmojiSearch))
      })).filter((group) => group.emojis.length > 0)
    : EMOJI_GROUPS.filter((group) => group.id === activeEmojiCategory);

  useEffect(() => {
    if (editingMessageId && !messages.some((message) => message.id === editingMessageId && !message.deletedAt)) {
      setEditingMessageId(null);
      setEditingText("");
    }
  }, [editingMessageId, messages]);

  async function handleUpdateMessageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingMessageId || !editingText.trim()) {
      return;
    }

    try {
      setPendingMessageId(editingMessageId);
      setMessageActionError("");
      await onUpdateMessage(editingMessageId, editingText.trim());
      setEditingMessageId(null);
      setEditingText("");
    } catch (caughtError) {
      setMessageActionError(caughtError instanceof Error ? caughtError.message : "Unable to update message.");
    } finally {
      setPendingMessageId(null);
    }
  }

  async function handleDeleteOwnMessage(messageId: number) {
    if (!window.confirm("Delete this message?")) {
      return;
    }

    try {
      setPendingMessageId(messageId);
      setMessageActionError("");
      await onDeleteMessage(messageId);

      if (editingMessageId === messageId) {
        setEditingMessageId(null);
        setEditingText("");
      }
    } catch (caughtError) {
      setMessageActionError(caughtError instanceof Error ? caughtError.message : "Unable to delete message.");
    } finally {
      setPendingMessageId(null);
    }
  }

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!(event.target instanceof Node)) {
        return;
      }

      if (openMenuRef.current && !openMenuRef.current.contains(event.target)) {
        setOpenMenuMessageId(null);
      }

      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target)) {
        setIsHeaderMenuOpen(false);
      }

      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target)) {
        setIsAttachmentMenuOpen(false);
      }

      if (expressionMenuRef.current && !expressionMenuRef.current.contains(event.target)) {
        setIsExpressionMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  function handleSelectDocument() {
    setIsAttachmentMenuOpen(false);
    composerDocumentInputRef.current?.click();
  }

  function handleSelectMedia() {
    setIsAttachmentMenuOpen(false);
    composerMediaInputRef.current?.click();
  }

  function handleSelectSticker() {
    setIsExpressionMenuOpen(false);
    composerStickerInputRef.current?.click();
  }

  function handleSelectGif() {
    setIsExpressionMenuOpen(false);
    composerGifInputRef.current?.click();
  }

  function handleComposerFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file) {
      void onUploadMedia(file);
    }

    event.target.value = "";
  }


  function closeHeaderMenu() {
    setIsHeaderMenuOpen(false);
  }

  function handleInsertEmoji(emoji: string) {
    onDraftChange(`${draft}${emoji}`);
  }

  async function handleSendBuiltInSticker(sticker: (typeof STICKER_PACKS)[number]) {
    try {
      setMessageActionError("");
      setIsExpressionMenuOpen(false);
      const response = await fetch(sticker.assetPath);

      if (!response.ok) {
        throw new Error("Unable to load sticker.");
      }

      const blob = await response.blob();
      const file = new File([blob], `${sticker.id}.svg`, { type: blob.type || "image/svg+xml" });
      await onUploadMedia(file);
    } catch {
      setMessageActionError("Unable to send sticker.");
    }
  }

  return (
    <section className="chat-panel">
      <header className="chat-header">
        <div className="chat-title-block">
          {activeConversation ? (
            <button aria-label="Back to chats" className="chat-back-button" type="button" onClick={onMobileBack}>
              <ChevronLeftIcon className="chat-back-icon" />
            </button>
          ) : null}
          <span className={`avatar-badge header-avatar ${activeConversationPresence.isOnline ? "live" : ""}`}>
            {activeDirectContact?.profileImageUrl ? (
              <img
                alt={activeDirectContact.displayName}
                className="avatar-image"
                src={resolveMediaUrl(activeDirectContact.profileImageUrl)}
              />
            ) : (
              initials(activeConversation?.displayName ?? "Chat")
            )}
            <span className={`presence-dot ${activeConversationPresence.isOnline ? "online" : ""}`} />
          </span>
          <div>
            <h2>{activeConversation?.displayName ?? "Select a chat"}</h2>
            <p className="muted-text chat-subtitle">{activeConversationPresence.subtitle}</p>
          </div>
        </div>
        <div className="chat-header-right">
          <div ref={headerMenuRef} className="chat-header-menu-shell">
            <button
              aria-expanded={isHeaderMenuOpen}
              aria-label="Open chat options"
              className="chat-header-menu-trigger"
              type="button"
              onClick={() => setIsHeaderMenuOpen((current) => !current)}
            >
              <MoreVerticalIcon className="chat-header-menu-icon" />
            </button>
            {isHeaderMenuOpen ? (
              <div className="chat-header-menu-dropdown">
                {activeDirectContact ? (
                  <>
                    {activeDirectContact.friendshipStatus === "none" ? (
                      <button
                        className="chat-header-menu-item"
                        type="button"
                        onClick={() => {
                          closeHeaderMenu();
                          void onSendFriendRequest(activeDirectContact.id);
                        }}
                      >
                        Add friend
                      </button>
                    ) : null}
                    {activeDirectContact.friendshipStatus === "outgoing" ? (
                      <button className="chat-header-menu-item" disabled type="button">
                        Request sent
                      </button>
                    ) : null}
                    {activeDirectContact.friendshipStatus === "incoming" && activeDirectContact.friendshipRequestId ? (
                      <Fragment>
                        <button
                          className="chat-header-menu-item"
                          type="button"
                          onClick={() => {
                            closeHeaderMenu();
                            void onAcceptFriendRequest(activeDirectContact.friendshipRequestId!);
                          }}
                        >
                          Accept request
                        </button>
                        <button
                          className="chat-header-menu-item danger"
                          type="button"
                          onClick={() => {
                            closeHeaderMenu();
                            void onDeclineFriendRequest(activeDirectContact.friendshipRequestId!);
                          }}
                        >
                          Decline request
                        </button>
                      </Fragment>
                    ) : null}
                    <div className="chat-header-menu-divider" />
                  </>
                ) : null}
                <button className="chat-header-menu-item" type="button" onClick={closeHeaderMenu}>
                  Search
                </button>
                <button className="chat-header-menu-item" type="button" onClick={closeHeaderMenu}>
                  Call
                </button>
                <button className="chat-header-menu-item" type="button" onClick={closeHeaderMenu}>
                  Info
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="message-stream" ref={messageStreamRef}>
        {messageActionError ? <p className="status-banner error floating-status">{messageActionError}</p> : null}
        {activeConversation ? (
          messages.length ? (
            messages.map((message) => {
              const mine = message.senderId === currentUser.id;
              const isEditing = editingMessageId === message.id;
              const isPending = pendingMessageId === message.id;
              const isDeleted = Boolean(message.deletedAt);
              const mediaUrl = resolveMediaUrl(message.mediaUrl);
              const isImage = Boolean(message.mediaContentType?.startsWith("image/") && mediaUrl);
              const hasFileAttachment = !isDeleted && !isImage && !!message.mediaFileName;
              const canShowMessageMenu = !isDeleted && !message.localStatus && message.id > 0;
              const canEditMessage = !message.mediaUrl;
              const isSendingLocally = message.localStatus === "sending";
              const isFailedLocally = message.localStatus === "failed";

              return (
                <article key={message.id} className={`message-row ${mine ? "mine" : ""}`}>
                  <div className={`message-bubble ${isDeleted ? "deleted" : ""}`}>
                    {!mine ? <p className="message-author">{message.senderDisplayName}</p> : null}
                    {isEditing ? (
                      <form className="message-edit-form" onSubmit={handleUpdateMessageSubmit}>
                        <input
                          autoFocus
                          value={editingText}
                          onChange={(event) => setEditingText(event.target.value)}
                          placeholder="Edit message"
                        />
                        <div className="message-edit-actions">
                          <button className="chat-action-button accent" disabled={isPending || !editingText.trim()} type="submit">
                            Save
                          </button>
                          <button
                            className="chat-action-button muted"
                            type="button"
                            onClick={() => {
                              setEditingMessageId(null);
                              setEditingText("");
                              setOpenMenuMessageId(null);
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        {isImage ? (
                          <a
                            className="message-media-link image"
                            href={mediaUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <img alt={message.mediaFileName ?? "Shared image"} className="message-media-image" src={mediaUrl} />
                          </a>
                        ) : null}
                        {hasFileAttachment ? (
                          mediaUrl ? (
                            <a className="message-file-card" href={mediaUrl} rel="noreferrer" target="_blank">
                              <span className="message-file-icon">
                                {(message.mediaFileName ?? "FILE").slice(0, 4).toUpperCase()}
                              </span>
                              <span className="message-file-copy">
                                <strong>{message.mediaFileName ?? "Attachment"}</strong>
                                <small>{formatFileSize(message.mediaFileSize)}</small>
                              </span>
                            </a>
                          ) : (
                            <div className="message-file-card pending">
                              <span className="message-file-icon">
                                {(message.mediaFileName ?? "FILE").slice(0, 4).toUpperCase()}
                              </span>
                              <span className="message-file-copy">
                                <strong>{message.mediaFileName ?? "Attachment"}</strong>
                                <small>{formatFileSize(message.mediaFileSize)}</small>
                              </span>
                            </div>
                          )
                        ) : null}
                        {message.text ? <p>{message.text}</p> : null}
                      </>
                    )}
                    {mine && !isEditing && canShowMessageMenu ? (
                      <div
                        ref={openMenuMessageId === message.id ? openMenuRef : null}
                        className="message-inline-actions menu-trigger"
                      >
                        <button
                          aria-label="Open message menu"
                          aria-expanded={openMenuMessageId === message.id}
                          className="message-menu-trigger"
                          disabled={isPending}
                          type="button"
                          onClick={() => {
                            setOpenMenuMessageId((current) => (current === message.id ? null : message.id));
                          }}
                        >
                          <CaretDownIcon className="message-menu-trigger-icon" />
                        </button>
                        {openMenuMessageId === message.id ? (
                          <div className="message-menu-dropdown">
                            {canEditMessage ? (
                              <button
                                className="message-menu-item"
                                disabled={isPending}
                                type="button"
                                onClick={() => {
                                  setEditingMessageId(message.id);
                                  setEditingText(message.text);
                                  setMessageActionError("");
                                  setOpenMenuMessageId(null);
                                }}
                              >
                                Edit
                              </button>
                            ) : null}
                            <button
                              className="message-menu-item danger"
                              disabled={isPending}
                              type="button"
                              onClick={() => {
                                setOpenMenuMessageId(null);
                                void handleDeleteOwnMessage(message.id);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="message-meta">
                      {message.deletedAt ? <span className="message-badge">Deleted</span> : null}
                      {message.editedAt && !message.deletedAt ? <span className="message-badge">Edited</span> : null}
                      {isFailedLocally ? <span className="message-badge failed">Failed</span> : null}
                      <time>{formatMessageTime(message.sentAt)}</time>
                      {mine && isSendingLocally ? (
                        <span className="message-status pending" title="Sending">
                          <PendingClockIcon className="message-pending-icon" />
                        </span>
                      ) : null}
                      {mine && isFailedLocally ? (
                        <span className="message-status failed" title="Failed to send">
                          <FailedMessageIcon className="message-failed-icon" />
                        </span>
                      ) : null}
                      {mine && !isSendingLocally && !isFailedLocally ? (
                        <span
                          className={`message-status ${message.readAt ? "read" : message.deliveredAt ? "delivered" : "sent"}`}
                          title={message.readAt ? "Seen" : message.deliveredAt ? "Delivered" : "Sent"}
                        >
                          <MessageTickIcon className="message-tick" />
                          {message.deliveredAt || message.readAt ? <MessageTickIcon className="message-tick overlap" /> : null}
                        </span>
                      ) : null}
                    </div>
                    {mine && isFailedLocally && message.clientMessageId ? (
                      <div className="message-retry-row">
                        <button
                          className="message-retry-button"
                          type="button"
                          onClick={() => void onRetryMessage(message.clientMessageId!)}
                        >
                          Retry
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })
          ) : (
            <div className="empty-state">
              <h3>No messages yet</h3>
              <p>Send the first message to turn this into a live conversation.</p>
            </div>
          )
        ) : (
          <div className="empty-state">
            <h3>React client ready</h3>
            <p>Register two users, then open a conversation from the sidebar to test the clone.</p>
          </div>
        )}
      </div>

      <form className="composer" onSubmit={onSendMessage}>
        <div className="composer-field">
          <input
            ref={composerDocumentInputRef}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.7z,.csv"
            className="composer-file-input"
            type="file"
            onChange={handleComposerFileChange}
          />
          <input
            ref={composerMediaInputRef}
            accept="image/*,video/*"
            className="composer-file-input"
            type="file"
            onChange={handleComposerFileChange}
          />
          <input
            ref={composerStickerInputRef}
            accept="image/webp,image/png,image/jpeg"
            className="composer-file-input"
            type="file"
            onChange={handleComposerFileChange}
          />
          <input
            ref={composerGifInputRef}
            accept="image/gif"
            className="composer-file-input"
            type="file"
            onChange={handleComposerFileChange}
          />
          <div ref={attachmentMenuRef} className="composer-attach-shell">
            <button
              aria-expanded={isAttachmentMenuOpen}
              aria-label="Open attachment menu"
              className="composer-attach"
              disabled={!activeConversation || isUploadingMedia}
              type="button"
              onClick={() => {
                setIsExpressionMenuOpen(false);
                setIsAttachmentMenuOpen((current) => !current);
              }}
            >
              <AttachmentIcon className="composer-attach-icon" />
            </button>
            {isAttachmentMenuOpen ? (
              <div className="composer-attach-menu">
                <button className="composer-attach-item" type="button" onClick={handleSelectDocument}>
                  <span className="composer-attach-item-icon document">D</span>
                  <span>Document</span>
                </button>
                <button className="composer-attach-item" type="button" onClick={handleSelectMedia}>
                  <span className="composer-attach-item-icon media">P</span>
                  <span>Photos &amp; media</span>
                </button>
              </div>
            ) : null}
          </div>
          <div ref={expressionMenuRef} className="composer-expression-shell">
            <button
              aria-expanded={isExpressionMenuOpen}
              aria-label="Open emoji and sticker menu"
              className="composer-expression"
              disabled={!activeConversation || isUploadingMedia}
              type="button"
              onClick={() => {
                setIsAttachmentMenuOpen(false);
                setIsExpressionMenuOpen((current) => !current);
              }}
            >
              <EmojiIcon className="composer-expression-icon" />
            </button>
            {isExpressionMenuOpen ? (
              <div className="composer-expression-menu">
                <div className="composer-expression-topbar">
                  <div className="composer-expression-tabs">
                    <button
                      className={`composer-expression-tab ${expressionTab === "emoji" ? "active" : ""}`}
                      type="button"
                      onClick={() => setExpressionTab("emoji")}
                    >
                      Emoji
                    </button>
                    <button
                      className={`composer-expression-tab ${expressionTab === "stickers" ? "active" : ""}`}
                      type="button"
                      onClick={() => setExpressionTab("stickers")}
                    >
                      Stickers
                    </button>
                    <button
                      className={`composer-expression-tab ${expressionTab === "uploads" ? "active" : ""}`}
                      type="button"
                      onClick={() => setExpressionTab("uploads")}
                    >
                      Uploads
                    </button>
                  </div>
                </div>
                {expressionTab === "emoji" ? (
                  <>
                    <label className="composer-expression-search">
                      <input
                        placeholder="Search emoji"
                        type="text"
                        value={emojiSearch}
                        onChange={(event) => setEmojiSearch(event.target.value)}
                      />
                    </label>
                    <div className="composer-emoji-tabs">
                      {EMOJI_GROUPS.map((group) => (
                        <button
                          key={group.id}
                          className={`composer-emoji-tab ${activeEmojiCategory === group.id ? "active" : ""}`}
                          type="button"
                          onClick={() => setActiveEmojiCategory(group.id)}
                        >
                          <span>{group.icon}</span>
                        </button>
                      ))}
                    </div>
                    <div className="composer-expression-scroll">
                      <div className="composer-expression-section">
                        {emojiGroupsToRender.length ? (
                          emojiGroupsToRender.map((group) => (
                            <div key={group.id} className="composer-expression-group">
                              <span className="composer-expression-label">{group.label}</span>
                              <div className="composer-emoji-grid large">
                                {group.emojis.map((emoji) => (
                                  <button
                                    key={`${group.id}-${emoji}`}
                                    className="composer-emoji-item"
                                    type="button"
                                    onClick={() => handleInsertEmoji(emoji)}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="composer-expression-empty">No emoji found.</p>
                        )}
                      </div>
                    </div>
                  </>
                ) : null}
                {expressionTab === "stickers" ? (
                  <div className="composer-expression-section">
                    <div className="composer-expression-group">
                      <span className="composer-expression-label">Built-in stickers</span>
                      <div className="composer-sticker-grid">
                        {STICKER_PACKS.map((sticker) => (
                          <button
                            key={sticker.id}
                            className="composer-sticker-item"
                            type="button"
                            onClick={() => void handleSendBuiltInSticker(sticker)}
                          >
                            <img alt={sticker.label} src={sticker.assetPath} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
                {expressionTab === "uploads" ? (
                  <div className="composer-expression-section">
                    <div className="composer-expression-group">
                      <span className="composer-expression-label">Quick uploads</span>
                      <button className="composer-attach-item" type="button" onClick={handleSelectSticker}>
                        <span className="composer-attach-item-icon sticker">S</span>
                        <span>Upload sticker</span>
                      </button>
                      <button className="composer-attach-item" type="button" onClick={handleSelectGif}>
                        <span className="composer-attach-item-icon gif">G</span>
                        <span>Upload GIF</span>
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <input
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder={activeConversation ? "Type a message" : "Select a conversation first"}
            disabled={!activeConversation || isUploadingMedia}
          />
          <button
            aria-label="Send message"
            className="composer-send"
            disabled={!activeConversation || isSending || isUploadingMedia || !draft.trim()}
            type="submit"
          >
            <SendIcon className="composer-send-icon" />
          </button>
        </div>
      </form>
    </section>
  );
}

export default ChatPanel;
