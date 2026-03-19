type ChatThemePreference = "system" | "light" | "dark";
type ChatWallpaperPreference = "default" | "mist" | "mint" | "lavender" | "sunset" | "midnight";

type ChatSettingsPanelProps = {
  themePreference: ChatThemePreference;
  appliedTheme: "light" | "dark";
  wallpaperPreference: ChatWallpaperPreference;
  isThemeDialogOpen: boolean;
  isWallpaperDialogOpen: boolean;
  isSaving: boolean;
  error: string;
  status: string;
  onBack: () => void;
  onOpenThemeDialog: () => void;
  onCloseThemeDialog: () => void;
  onApplyTheme: (theme: ChatThemePreference) => void;
  onOpenWallpaperDialog: () => void;
  onCloseWallpaperDialog: () => void;
  onApplyWallpaper: (wallpaper: ChatWallpaperPreference) => void;
};

const wallpaperOptions: Array<{ value: ChatWallpaperPreference; label: string; swatchClass: string }> = [
  { value: "default", label: "Default", swatchClass: "default" },
  { value: "mist", label: "Mist", swatchClass: "mist" },
  { value: "mint", label: "Mint", swatchClass: "mint" },
  { value: "lavender", label: "Lavender", swatchClass: "lavender" },
  { value: "sunset", label: "Sunset", swatchClass: "sunset" },
  { value: "midnight", label: "Midnight", swatchClass: "midnight" }
];

function BackIcon({ className }: { className?: string }) {
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

function ChevronIcon({ className }: { className?: string }) {
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

function PaletteIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <path
        d="M12 4.5c-4.4 0-8 3.1-8 6.9 0 2.2 1.2 3.7 3 3.7h1.2c.9 0 1.6.7 1.6 1.6 0 1.5 1 2.3 2.6 2.3 4.2 0 7.6-3.2 7.6-7.2 0-4.2-3.6-7.3-8-7.3Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle cx="8.2" cy="10" r="1" fill="currentColor" />
      <circle cx="11.4" cy="8.4" r="1" fill="currentColor" />
      <circle cx="14.8" cy="9.2" r="1" fill="currentColor" />
      <circle cx="15.8" cy="12.5" r="1" fill="currentColor" />
    </svg>
  );
}

function WallpaperIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <rect x="4.5" y="5.5" width="15" height="13" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="10" r="1.2" fill="currentColor" />
      <path
        d="m7.2 16 3.2-3.3 2.3 2.1 2.1-2.3 2 3.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ChatSettingsPanel({
  themePreference,
  appliedTheme,
  wallpaperPreference,
  isThemeDialogOpen,
  isWallpaperDialogOpen,
  isSaving,
  error,
  status,
  onBack,
  onOpenThemeDialog,
  onCloseThemeDialog,
  onApplyTheme,
  onOpenWallpaperDialog,
  onCloseWallpaperDialog,
  onApplyWallpaper
}: ChatSettingsPanelProps) {
  const themeSummary = themePreference === "system" ? `System default (${appliedTheme})` : themePreference;

  return (
    <section className="settings-detail-panel">
      <header className="settings-detail-header">
        <button aria-label="Back to settings" className="ghost-button settings-back-button" type="button" onClick={onBack}>
          <BackIcon className="settings-back-icon" />
        </button>
        <div>
          <p className="eyebrow">Chats</p>
          <h3>Chat settings</h3>
        </div>
      </header>

      <div className="chat-settings-card compact-chat-settings-card whatsapp-like-settings-card">
        <div className="section-heading inner">
          <span>Display</span>
        </div>

        <div className="chat-settings-list compact-settings-list">
          <button className="chat-settings-option-row whatsapp-like-settings-row" type="button" onClick={onOpenThemeDialog}>
            <span className="chat-settings-option-icon">
              <PaletteIcon className="chat-settings-option-svg" />
            </span>
            <span className="chat-settings-row-copy">
              <strong>Theme</strong>
              <small>{themeSummary.charAt(0).toUpperCase() + themeSummary.slice(1)}</small>
            </span>
            <ChevronIcon className="chat-settings-chevron" />
          </button>

          <button className="chat-settings-option-row whatsapp-like-settings-row" type="button" onClick={onOpenWallpaperDialog}>
            <span className={`chat-settings-option-icon wallpaper-preview ${wallpaperPreference}`}>
              <WallpaperIcon className="chat-settings-option-svg" />
            </span>
            <span className="chat-settings-row-copy">
              <strong>Wallpaper</strong>
              <small>{wallpaperPreference.charAt(0).toUpperCase() + wallpaperPreference.slice(1)}</small>
            </span>
            <ChevronIcon className="chat-settings-chevron" />
          </button>
        </div>

        {error ? <p className="status-banner error">{error}</p> : null}
        {status ? <p className="status-banner">{status}</p> : null}
      </div>

      {isThemeDialogOpen ? (
        <div className="settings-dialog-backdrop" role="presentation" onClick={onCloseThemeDialog}>
          <div aria-labelledby="theme-dialog-title" aria-modal="true" className="settings-dialog" role="dialog" onClick={(event) => event.stopPropagation()}>
            <div className="settings-dialog-copy">
              <h4 id="theme-dialog-title">Theme</h4>
              <p className="settings-dialog-subtitle">Choose how your chats should look.</p>
            </div>

            <div className="settings-dialog-options">
              {(["light", "dark", "system"] as ChatThemePreference[]).map((option) => (
                <button
                  key={option}
                  className={`settings-dialog-option-button ${themePreference === option ? "active" : ""}`}
                  disabled={isSaving}
                  type="button"
                  onClick={() => onApplyTheme(option)}
                >
                  <span className="settings-dialog-option-copy">
                    <strong>{option === "system" ? "System default" : option.charAt(0).toUpperCase() + option.slice(1)}</strong>
                    <small>
                      {option === "light"
                        ? "Light surfaces and bright chat tones"
                        : option === "dark"
                          ? "Deeper contrast for night use"
                          : "Follow your device appearance"}
                    </small>
                  </span>
                  <span className="settings-dialog-option-indicator" aria-hidden="true" />
                </button>
              ))}
            </div>

            <div className="settings-dialog-actions">
              <button className="ghost-button" type="button" onClick={onCloseThemeDialog}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isWallpaperDialogOpen ? (
        <div className="settings-dialog-backdrop" role="presentation" onClick={onCloseWallpaperDialog}>
          <div aria-labelledby="wallpaper-dialog-title" aria-modal="true" className="settings-dialog settings-dialog-wide" role="dialog" onClick={(event) => event.stopPropagation()}>
            <div className="settings-dialog-copy">
              <h4 id="wallpaper-dialog-title">Wallpaper</h4>
              <p className="settings-dialog-subtitle">Pick a background for your chat area.</p>
            </div>

            <div className="settings-dialog-wallpaper-grid">
              {wallpaperOptions.map((option) => (
                <button
                  key={option.value}
                  className={`chat-wallpaper-swatch ${option.swatchClass} ${wallpaperPreference === option.value ? "active" : ""}`}
                  disabled={isSaving}
                  type="button"
                  onClick={() => onApplyWallpaper(option.value)}
                >
                  <span>{option.label}</span>
                </button>
              ))}
            </div>

            <div className="settings-dialog-actions">
              <button className="ghost-button" type="button" onClick={onCloseWallpaperDialog}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export type { ChatThemePreference, ChatWallpaperPreference };
export default ChatSettingsPanel;
