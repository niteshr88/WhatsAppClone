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
          <h2>{currentUser.displayName}</h2>
        </div>
        <div className="sidebar-top-actions">
          {!isEditingProfile ? (
            <button className="ghost-button" type="button" onClick={onStartEdit}>
              Edit
            </button>
          ) : null}
          <button className="ghost-button" type="button" onClick={onShowPeople}>
            People
          </button>
        </div>
      </header>

      <div className="sidebar-profile-preview">
        {previewImage ? <img alt={currentUser.displayName} src={previewImage} /> : <span>{initials(previewName)}</span>}
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
          <label>
            <span>Profile image URL</span>
            <input
              value={profileForm.profileImageUrl ?? ""}
              onChange={(event) => onProfileFieldChange("profileImageUrl", event.target.value)}
              placeholder="https://example.com/avatar.jpg"
            />
          </label>
          <label>
            <span>Upload image</span>
            <input accept="image/*" onChange={onProfileImageUpload} type="file" />
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
