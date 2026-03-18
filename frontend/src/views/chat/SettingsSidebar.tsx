import type { AuthUser } from "../../types";
import { initials } from "../../utils/chat";
import { resolveMediaUrl } from "../../api";

type SettingsSidebarProps = {
  currentUser: AuthUser;
  search: string;
  onSearchChange: (value: string) => void;
  onOpenProfileSettings: () => void;
  onOpenChatSettings: () => void;
};

function SettingsSearchIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path d="m16 16 4 4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
    </svg>
  );
}

function SettingsChevronIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 20 20">
      <path
        d="M7.5 4.5 13 10l-5.5 5.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function SettingsChatsIcon({ className }: { className?: string }) {
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

function SettingsSidebar({
  currentUser,
  search,
  onSearchChange,
  onOpenProfileSettings,
  onOpenChatSettings
}: SettingsSidebarProps) {
  const profileImageUrl = resolveMediaUrl(currentUser.profileImageUrl);
  const filter = search.trim().toLowerCase();
  const showChatsRow = !filter || "chats theme wallpaper chat settings".includes(filter);

  return (
    <section className="settings-panel">
      <header className="settings-header">
        <div>
          <p className="eyebrow">Preferences</p>
          <h2>Settings</h2>
        </div>
      </header>

      <label className="settings-search">
        <span className="settings-search-icon-shell">
          <SettingsSearchIcon className="settings-search-icon" />
        </span>
        <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search settings" />
      </label>

      <button className="settings-profile-card" type="button" onClick={onOpenProfileSettings}>
        <span className="settings-profile-avatar">
          {profileImageUrl ? <img alt={currentUser.displayName} className="avatar-image" src={profileImageUrl} /> : initials(currentUser.displayName)}
        </span>
        <span className="settings-profile-copy">
          <strong>{currentUser.displayName}</strong>
          <small>{currentUser.bio || "Tap to edit your profile"}</small>
        </span>
        <SettingsChevronIcon className="settings-row-chevron" />
      </button>

      <div className="settings-group">
        {showChatsRow ? (
          <button className="settings-row" type="button" onClick={onOpenChatSettings}>
            <span className="settings-row-icon">
              <SettingsChatsIcon className="settings-row-svg" />
            </span>
            <span className="settings-row-copy">
              <strong>Chats</strong>
              <small>Theme, wallpaper, chat appearance</small>
            </span>
            <SettingsChevronIcon className="settings-row-chevron" />
          </button>
        ) : (
          <div className="sidebar-empty settings-empty">
            <p>No matching settings.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default SettingsSidebar;
