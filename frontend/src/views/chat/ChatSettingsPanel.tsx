type ChatThemePreference = "system" | "light" | "dark";
type ChatWallpaperPreference = "default" | "mist" | "mint" | "lavender" | "sunset" | "midnight";

type ChatSettingsPanelProps = {
  savedThemePreference: ChatThemePreference;
  draftThemePreference: ChatThemePreference;
  appliedTheme: "light" | "dark";
  savedWallpaperPreference: ChatWallpaperPreference;
  draftWallpaperPreference: ChatWallpaperPreference;
  isThemeDialogOpen: boolean;
  isSaving: boolean;
  error: string;
  status: string;
  onBack: () => void;
  onOpenThemeDialog: () => void;
  onCloseThemeDialog: () => void;
  onThemeDraftChange: (theme: ChatThemePreference) => void;
  onConfirmThemeDialog: () => void;
  onPreviewWallpaper: (wallpaper: ChatWallpaperPreference) => void;
  onDiscardWallpaperPreview: () => void;
  onSaveWallpaper: () => void;
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

function ChatSettingsPanel({
  savedThemePreference,
  draftThemePreference,
  appliedTheme,
  savedWallpaperPreference,
  draftWallpaperPreference,
  isThemeDialogOpen,
  isSaving,
  error,
  status,
  onBack,
  onOpenThemeDialog,
  onCloseThemeDialog,
  onThemeDraftChange,
  onConfirmThemeDialog,
  onPreviewWallpaper,
  onDiscardWallpaperPreview,
  onSaveWallpaper
}: ChatSettingsPanelProps) {
  const hasWallpaperChanges = savedWallpaperPreference !== draftWallpaperPreference;
  const themeSummary = savedThemePreference === "system" ? `System default (${appliedTheme})` : savedThemePreference;

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

      <div className="chat-settings-card">
        <div className="section-heading inner">
          <span>Display</span>
        </div>

        <div className="chat-settings-list">
          <button className="chat-settings-trigger" type="button" onClick={onOpenThemeDialog}>
            <span className="chat-settings-row-copy">
              <strong>Theme</strong>
              <small>{themeSummary}</small>
            </span>
            <ChevronIcon className="chat-settings-chevron" />
          </button>

          <div className="chat-settings-wallpaper-section">
            <div className="chat-settings-row-copy">
              <strong>Wallpaper</strong>
              <small>{hasWallpaperChanges ? `Previewing ${draftWallpaperPreference}` : `Current: ${savedWallpaperPreference}`}</small>
            </div>

            <div className={`chat-wallpaper-preview ${draftWallpaperPreference}`}>
              <div className="chat-wallpaper-preview-bubble incoming">Preview bubble</div>
              <div className="chat-wallpaper-preview-bubble outgoing">Looks good</div>
            </div>

            <div className="chat-wallpaper-grid">
              {wallpaperOptions.map((option) => (
                <button
                  key={option.value}
                  className={`chat-wallpaper-swatch ${option.swatchClass} ${draftWallpaperPreference === option.value ? "active" : ""}`}
                  type="button"
                  onClick={() => onPreviewWallpaper(option.value)}
                >
                  <span>{option.label}</span>
                </button>
              ))}
            </div>

            <div className="chat-wallpaper-actions">
              <button className="ghost-button" disabled={!hasWallpaperChanges || isSaving} type="button" onClick={onDiscardWallpaperPreview}>
                Cancel preview
              </button>
              <button className="primary-button" disabled={!hasWallpaperChanges || isSaving} type="button" onClick={onSaveWallpaper}>
                {isSaving ? "Saving..." : "Apply wallpaper"}
              </button>
            </div>
          </div>
        </div>

        {error ? <p className="status-banner error">{error}</p> : null}
        {status ? <p className="status-banner">{status}</p> : null}
      </div>

      {isThemeDialogOpen ? (
        <div className="settings-dialog-backdrop" role="presentation" onClick={onCloseThemeDialog}>
          <div aria-labelledby="theme-dialog-title" aria-modal="true" className="settings-dialog" role="dialog" onClick={(event) => event.stopPropagation()}>
            <div className="settings-dialog-copy">
              <h4 id="theme-dialog-title">Theme</h4>
            </div>

            <div className="settings-dialog-options">
              {(["light", "dark", "system"] as ChatThemePreference[]).map((option) => (
                <label key={option} className="settings-dialog-option">
                  <input checked={draftThemePreference === option} name="chat-theme" type="radio" onChange={() => onThemeDraftChange(option)} />
                  <span>{option === "system" ? "System default" : option.charAt(0).toUpperCase() + option.slice(1)}</span>
                </label>
              ))}
            </div>

            <div className="settings-dialog-actions">
              <button className="ghost-button" type="button" onClick={onCloseThemeDialog}>
                Cancel
              </button>
              <button className="primary-button" type="button" onClick={onConfirmThemeDialog}>
                OK
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
