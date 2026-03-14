import type { AuthUser } from "../../types";
import { initials } from "../../utils/chat";

type SidebarRailProps = {
  currentUser: AuthUser;
  sidebarView: "friends" | "requests" | "discover" | "profile";
  requestCount: number;
  discoverCount: number;
  onShowFriends: () => void;
  onShowRequests: () => void;
  onShowDiscover: () => void;
  onShowProfile: () => void;
  onEditProfile: () => void;
  onLogout: () => void;
};

function RailChatsIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <path
        d="M6.5 7.5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-6.4l-3.7 2.6c-.5.3-1.2 0-1.2-.7v-1.9h-.7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="M8.5 11.5h7M8.5 14.5h5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function RailProfileIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <path
        d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5.5 19.2a6.8 6.8 0 0 1 13 0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function RailRequestsIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <path
        d="M12 6.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M6.2 18.8a6.4 6.4 0 0 1 11.6-2.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path d="M18 8.5v5m-2.5-2.5h5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function RailDiscoverIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="7.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m14.9 9.1-4.2 1.9-1.6 4 4.1-1.8 1.7-4.1Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  );
}

function RailSettingsIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <path
        d="M12 8.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19 12a7 7 0 0 0-.1-1.1l2-1.5-1.9-3.3-2.4 1a7.7 7.7 0 0 0-1.9-1.1l-.4-2.5h-3.8l-.4 2.5a7.7 7.7 0 0 0-1.9 1.1l-2.4-1-1.9 3.3 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.1l-2 1.5 1.9 3.3 2.4-1c.6.5 1.2.8 1.9 1.1l.4 2.5h3.8l.4-2.5c.7-.3 1.3-.6 1.9-1.1l2.4 1 1.9-3.3-2-1.5c.1-.3.1-.7.1-1.1Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function RailLogoutIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <path
        d="M10 5.5H7.8A2.3 2.3 0 0 0 5.5 7.8v8.4a2.3 2.3 0 0 0 2.3 2.3H10"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M14.2 8.5 18.5 12l-4.3 3.5M18 12H9.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function SidebarRail({
  currentUser,
  sidebarView,
  requestCount,
  discoverCount,
  onShowFriends,
  onShowRequests,
  onShowDiscover,
  onShowProfile,
  onEditProfile,
  onLogout
}: SidebarRailProps) {
  return (
    <nav className="sidebar-rail">
      <div className="sidebar-rail-group">
        <button
          aria-label="Friends"
          className={`rail-button ${sidebarView === "friends" ? "active" : ""}`}
          type="button"
          onClick={onShowFriends}
        >
          <RailChatsIcon className="rail-icon" />
        </button>
        <button
          aria-label="Friend requests"
          className={`rail-button ${sidebarView === "requests" ? "active" : ""}`}
          type="button"
          onClick={onShowRequests}
        >
          <RailRequestsIcon className="rail-icon" />
          {requestCount > 0 ? <span className="rail-button-badge">{requestCount}</span> : null}
        </button>
        <button
          aria-label="Unknown people"
          className={`rail-button ${sidebarView === "discover" ? "active" : ""}`}
          type="button"
          onClick={onShowDiscover}
        >
          <RailDiscoverIcon className="rail-icon" />
          {discoverCount > 0 ? <span className="rail-button-badge secondary">{discoverCount}</span> : null}
        </button>
        <button
          aria-label="Profile"
          className={`rail-button ${sidebarView === "profile" ? "active" : ""}`}
          type="button"
          onClick={onShowProfile}
        >
          <RailProfileIcon className="rail-icon" />
        </button>
      </div>
      <div className="sidebar-rail-group">
        <button aria-label="Edit profile" className="rail-button" type="button" onClick={onEditProfile}>
          <RailSettingsIcon className="rail-icon" />
        </button>
        <button aria-label="Log out" className="rail-button" type="button" onClick={onLogout}>
          <RailLogoutIcon className="rail-icon" />
        </button>
        <button aria-label="Open profile panel" className="rail-avatar-button" type="button" onClick={onShowProfile}>
          {currentUser.profileImageUrl ? (
            <img alt={currentUser.displayName} className="rail-avatar-image" src={currentUser.profileImageUrl} />
          ) : (
            <span>{initials(currentUser.displayName)}</span>
          )}
        </button>
      </div>
    </nav>
  );
}

export default SidebarRail;
