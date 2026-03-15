import type { ChangeEvent, FormEvent } from "react";
import type { AuthUser, UpdateProfileRequest } from "../../types";
import { initials } from "../../utils/chat";

type ProfileSidebarProps = {
  currentUser: AuthUser;
  isEditingProfile: boolean;
  profileForm: UpdateProfileRequest;
  profileError: string;
  profileStatus: string;
  isSavingProfile: boolean;
  onShowPeople: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onLogout: () => void;
  onProfileFieldChange: (field: keyof UpdateProfileRequest, value: string) => void;
  onProfileImageUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onSaveProfile: (event: FormEvent<HTMLFormElement>) => void;
};

function ProfileImageEditIcon({ className }: { className?: string }) {
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

function ProfileBackIcon({ className }: { className?: string }) {
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

function ProfileSidebar({
  currentUser,
  isEditingProfile,
  profileForm,
  profileError,
  profileStatus,
  isSavingProfile,
  onShowPeople,
  onStartEdit,
  onCancelEdit,
  onLogout,
  onProfileFieldChange,
  onProfileImageUpload,
  onSaveProfile
}: ProfileSidebarProps) {
  const previewName = isEditingProfile ? profileForm.displayName || currentUser.displayName : currentUser.displayName;
  const previewImage = isEditingProfile ? profileForm.profileImageUrl : currentUser.profileImageUrl;

  return (
    <section className="sidebar-profile-panel">
      <header className="sidebar-profile-header">
        <div>
          <p className="eyebrow">Profile</p>
        </div>
        <div className="sidebar-top-actions">
          {!isEditingProfile ? (
            <button className="ghost-button" type="button" onClick={onStartEdit}>
              Edit
            </button>
          ) : null}
          <button aria-label="Back to people" className="ghost-button profile-back-button" type="button" onClick={onShowPeople}>
            <ProfileBackIcon className="profile-back-icon" />
          </button>
        </div>
      </header>

      <div className="sidebar-profile-preview-shell">
        <div className="sidebar-profile-preview">
          {previewImage ? <img alt={currentUser.displayName} src={previewImage} /> : <span>{initials(previewName)}</span>}
        </div>
        {isEditingProfile ? (
          <label className="sidebar-profile-image-trigger">
            <input accept="image/*" className="sidebar-profile-image-input" onChange={onProfileImageUpload} type="file" />
            <ProfileImageEditIcon className="sidebar-profile-image-icon" />
          </label>
        ) : null}
      </div>

      {isEditingProfile ? (
        <form className="sidebar-profile-form" onSubmit={onSaveProfile}>
          <label>
            <span>Display name</span>
            <input
              value={profileForm.displayName}
              onChange={(event) => onProfileFieldChange("displayName", event.target.value)}
              placeholder="Your name"
              required
            />
          </label>
          <label>
            <span>About</span>
            <input
              maxLength={120}
              value={profileForm.bio ?? ""}
              onChange={(event) => onProfileFieldChange("bio", event.target.value)}
              placeholder="One line about you"
            />
          </label>
          {profileError ? <p className="status-banner error">{profileError}</p> : null}
          {profileStatus ? <p className="status-banner">{profileStatus}</p> : null}
          <div className="sidebar-profile-actions">
            <button className="ghost-button" type="button" onClick={onCancelEdit}>
              Cancel
            </button>
            <button className="primary-button" disabled={isSavingProfile} type="submit">
              {isSavingProfile ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="sidebar-profile-meta">
            <div>
              <p className="sidebar-profile-label">About</p>
              <p>{currentUser.bio || "Add a one-line bio from profile settings."}</p>
            </div>
            <div>
              <p className="sidebar-profile-label">Email</p>
              <p>{currentUser.email}</p>
            </div>
          </div>

          <div className="sidebar-profile-actions">
            <button className="ghost-button" type="button" onClick={onStartEdit}>
              Edit profile
            </button>
            <button className="ghost-button" type="button" onClick={onLogout}>
              Log out
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export default ProfileSidebar;
