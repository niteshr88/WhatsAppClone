import type { ChangeEvent, FormEvent } from "react";
import type { AuthUser, UpdateProfileRequest } from "../../types";
import { initials } from "../../utils/chat";

type ProfileSettingsPanelProps = {
  currentUser: AuthUser;
  profileForm: UpdateProfileRequest;
  profileError: string;
  profileStatus: string;
  isSavingProfile: boolean;
  onBack: () => void;
  onProfileFieldChange: (field: keyof UpdateProfileRequest, value: string) => void;
  onProfileImageUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onSaveProfile: (event: FormEvent<HTMLFormElement>) => void;
};

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

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <path
        d="M9 18h6.8a2.2 2.2 0 0 0 2.2-2.2V9.4a2.2 2.2 0 0 0-2.2-2.2h-2l-1-1.6H11.2l-1 1.6h-2A2.2 2.2 0 0 0 6 9.4v6.4A2.2 2.2 0 0 0 8.2 18H9Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12.2" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ProfileSettingsPanel({
  currentUser,
  profileForm,
  profileError,
  profileStatus,
  isSavingProfile,
  onBack,
  onProfileFieldChange,
  onProfileImageUpload,
  onSaveProfile
}: ProfileSettingsPanelProps) {
  const previewName = profileForm.displayName || currentUser.displayName;
  const previewImage = profileForm.profileImageUrl || currentUser.profileImageUrl;

  return (
    <section className="settings-detail-panel">
      <header className="settings-detail-header">
        <button aria-label="Back to settings" className="ghost-button settings-back-button" type="button" onClick={onBack}>
          <BackIcon className="settings-back-icon" />
        </button>
        <div>
          <p className="eyebrow">Profile</p>
          <h3>Edit profile</h3>
        </div>
      </header>

      <form className="settings-profile-form" onSubmit={onSaveProfile}>
        <div className="settings-profile-hero">
          <div className="settings-profile-avatar-shell">
            <div className="settings-profile-avatar">
              {previewImage ? <img alt={currentUser.displayName} className="avatar-image" src={previewImage} /> : initials(previewName)}
            </div>
            <label className="settings-profile-image-trigger">
              <input accept="image/*" className="settings-profile-image-input" onChange={onProfileImageUpload} type="file" />
              <CameraIcon className="settings-profile-image-icon" />
            </label>
          </div>
          <div className="settings-profile-hero-copy">
            <strong>{previewName}</strong>
            <small>{profileForm.bio || "Add a short line about yourself"}</small>
          </div>
        </div>

        <label>
          <span>Display name</span>
          <input
            placeholder="Your name"
            required
            value={profileForm.displayName}
            onChange={(event) => onProfileFieldChange("displayName", event.target.value)}
          />
        </label>

        <label>
          <span>About</span>
          <input
            maxLength={120}
            placeholder="One line about you"
            value={profileForm.bio ?? ""}
            onChange={(event) => onProfileFieldChange("bio", event.target.value)}
          />
        </label>

        {profileError ? <p className="status-banner error">{profileError}</p> : null}
        {profileStatus ? <p className="status-banner">{profileStatus}</p> : null}

        <div className="settings-profile-actions">
          <button className="ghost-button" type="button" onClick={onBack}>
            Cancel
          </button>
          <button className="primary-button" disabled={isSavingProfile} type="submit">
            {isSavingProfile ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default ProfileSettingsPanel;
