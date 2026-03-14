import type { AuthUser, Conversation } from "../../types";
import { formatSidebarDate, initials } from "../../utils/chat";
import { resolveMediaUrl } from "../../api";

type PeopleSidebarProps = {
  mode: "friends" | "requests" | "discover";
  search: string;
  notificationPermission: NotificationPermission | "unsupported";
  onSearchChange: (value: string) => void;
  incomingRequestContacts: AuthUser[];
  friendContacts: AuthUser[];
  discoverContacts: AuthUser[];
  conversationByUserId: Map<string, Conversation>;
  activeConversationId: number | null;
  unreadCounts: Record<number, number>;
  onlineUserIds: ReadonlySet<string>;
  onSelectContact: (contact: AuthUser) => void | Promise<void>;
  onAcceptFriendRequest: (requestId: number) => void | Promise<void>;
  onDeclineFriendRequest: (requestId: number) => void | Promise<void>;
  onSendFriendRequest: (recipientId: string) => void | Promise<void>;
  getFriendshipLabel: (contact: AuthUser) => string | null;
};

function PeopleSidebar({
  mode,
  search,
  notificationPermission,
  onSearchChange,
  incomingRequestContacts,
  friendContacts,
  discoverContacts,
  conversationByUserId,
  activeConversationId,
  unreadCounts,
  onlineUserIds,
  onSelectContact,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  onSendFriendRequest,
  getFriendshipLabel
}: PeopleSidebarProps) {
  function renderAvatar(contact: AuthUser, isOnline: boolean) {
    const profileImageUrl = resolveMediaUrl(contact.profileImageUrl);

    return (
      <span className={`avatar-badge ${isOnline ? "live" : ""}`}>
        {profileImageUrl ? (
          <img alt={contact.displayName} className="avatar-image" src={profileImageUrl} />
        ) : (
          initials(contact.displayName)
        )}
        <span className={`presence-dot ${isOnline ? "online" : ""}`} />
      </span>
    );
  }

  const isRequestsMode = mode === "requests";
  const isDiscoverMode = mode === "discover";
  const title = isRequestsMode ? "Friend Requests" : isDiscoverMode ? "Unknown People" : "Friends";
  const titleCount = isRequestsMode ? incomingRequestContacts.length : isDiscoverMode ? discoverContacts.length : friendContacts.length;

  return (
    <>
      <header className="sidebar-top">
        <div>
          <h1>Sandesaa</h1>
        </div>
        <div className="sidebar-top-actions">
          {notificationPermission === "granted" ? (
            <button className="ghost-button" disabled type="button">
              Alerts on
            </button>
          ) : null}
          {notificationPermission === "denied" ? (
            <button className="ghost-button" disabled type="button">
              Alerts blocked
            </button>
          ) : null}
        </div>
      </header>

      <label className="search-box">
        <span>Search contacts</span>
        <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Start a new conversation" />
      </label>

      <section className="sidebar-section">
        <div className="section-heading">
          <span>{title}</span>
          <span>{titleCount}</span>
        </div>
        <div className={`sidebar-scroll-list ${isRequestsMode ? "request-list" : "contact-list"} ${!isRequestsMode && !isDiscoverMode ? "compact-list" : ""}`}>
          {isRequestsMode ? (
            incomingRequestContacts.length ? (
              incomingRequestContacts.map((contact) => {
                const conversation = conversationByUserId.get(contact.id);
                const isOnline = onlineUserIds.has(contact.id);

                return (
                  <article key={contact.id} className="request-card">
                    <button className="request-card-main" type="button" onClick={() => void onSelectContact(contact)}>
                      {renderAvatar(contact, isOnline)}
                      <span className="conversation-copy">
                        <span className="conversation-heading-row">
                          <strong>{contact.displayName}</strong>
                          <span className="friendship-tag incoming">Sent you a request</span>
                        </span>
                        <small>{conversation?.lastMessageText ?? contact.bio ?? "Open chat to know them better."}</small>
                      </span>
                    </button>
                    <div className="request-card-actions">
                      <button
                        className="chat-action-button accent"
                        type="button"
                        onClick={() => void onAcceptFriendRequest(contact.friendshipRequestId!)}
                      >
                        Accept
                      </button>
                      <button
                        className="chat-action-button muted"
                        type="button"
                        onClick={() => void onDeclineFriendRequest(contact.friendshipRequestId!)}
                      >
                        Decline
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="sidebar-empty">
                <p>No pending requests.</p>
              </div>
            )
          ) : null}

          {!isRequestsMode && !isDiscoverMode ? (
            friendContacts.length ? (
              friendContacts.map((contact) => {
                const conversation = conversationByUserId.get(contact.id);
                const isActive = conversation?.id === activeConversationId;
                const unreadCount = conversation ? unreadCounts[conversation.id] ?? 0 : 0;
                const isOnline = onlineUserIds.has(contact.id);

                return (
                  <button
                    key={contact.id}
                    className={`contact-card ${isActive ? "active" : ""}`}
                    type="button"
                    onClick={() => void onSelectContact(contact)}
                  >
                    {renderAvatar(contact, isOnline)}
                    <span className="conversation-copy">
                      <span className="conversation-heading-row">
                        <strong>{contact.displayName}</strong>
                        <span className="friendship-tag friends">Friend</span>
                      </span>
                      <small>{conversation?.lastMessageText ?? contact.bio ?? "Start a conversation"}</small>
                    </span>
                    <span className="conversation-meta">
                      <time>{conversation ? formatSidebarDate(conversation.lastMessageAt ?? conversation.createdAt) : ""}</time>
                      {unreadCount > 0 ? <span className="unread-badge">{unreadCount}</span> : null}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="sidebar-empty">
                <p>No friends yet.</p>
              </div>
            )
          ) : null}

          {isDiscoverMode ? (
            discoverContacts.length ? (
              discoverContacts.map((contact) => {
                const conversation = conversationByUserId.get(contact.id);
                const isActive = conversation?.id === activeConversationId;
                const unreadCount = conversation ? unreadCounts[conversation.id] ?? 0 : 0;
                const isOnline = onlineUserIds.has(contact.id);
                const friendshipLabel = getFriendshipLabel(contact);

                return (
                  <div key={contact.id} className={`contact-card discover-card ${isActive ? "active" : ""}`}>
                    <button className="contact-card-main" type="button" onClick={() => void onSelectContact(contact)}>
                      {renderAvatar(contact, isOnline)}
                      <span className="conversation-copy">
                        <span className="conversation-heading-row">
                          <strong>{contact.displayName}</strong>
                          {friendshipLabel ? <span className={`friendship-tag ${contact.friendshipStatus ?? "none"}`}>{friendshipLabel}</span> : null}
                        </span>
                        <small>{conversation?.lastMessageText ?? "Start a conversation"}</small>
                      </span>
                      <span className="conversation-meta">
                        <time>{conversation ? formatSidebarDate(conversation.lastMessageAt ?? conversation.createdAt) : ""}</time>
                        {unreadCount > 0 ? <span className="unread-badge">{unreadCount}</span> : null}
                      </span>
                    </button>
                    <div className="contact-card-action-slot">
                      {contact.friendshipStatus === "none" ? (
                        <button
                          className="inline-friend-action"
                          type="button"
                          onClick={() => void onSendFriendRequest(contact.id)}
                        >
                          Send request
                        </button>
                      ) : contact.friendshipStatus === "outgoing" ? (
                        <button className="inline-friend-action sent" disabled type="button">
                          Request sent
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="sidebar-empty">
                <p>No unknown users right now.</p>
              </div>
            )
          ) : null}
        </div>
      </section>
    </>
  );
}

export default PeopleSidebar;

