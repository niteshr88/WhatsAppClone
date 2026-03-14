import { ChangeEvent, FormEvent, useEffect, useState, useTransition } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, updateCurrentUser } from "../api";
import type { Session, UpdateProfileRequest } from "../types";

type ProfileSettingsViewProps = {
  session: Session;
  onSessionChange: (session: Session | null) => void;
};

function ProfileSettingsView({ session, onSessionChange }: ProfileSettingsViewProps) {
  const navigate = useNavigate();
  const [form, setForm] = useState<UpdateProfileRequest>({
    displayName: session.user.displayName,
    profileImageUrl: session.user.profileImageUrl ?? "",
    bio: session.user.bio ?? ""
  });
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let disposed = false;

    async function loadProfile() {
      try {
        const currentUser = await getCurrentUser(session.token);

        if (disposed) {
          return;
        }

        setForm({
          displayName: currentUser.displayName,
          profileImageUrl: currentUser.profileImageUrl ?? "",
          bio: currentUser.bio ?? ""
        });
      } catch (caughtError) {
        if (!disposed) {
          setError(caughtError instanceof Error ? caughtError.message : "Unable to load profile.");
        }
      }
    }

    void loadProfile();

    return () => {
      disposed = true;
    };
  }, [session.token]);

  function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({
        ...current,
        profileImageUrl: typeof reader.result === "string" ? reader.result : current.profileImageUrl
      }));
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");

    startTransition(async () => {
      try {
        const updatedUser = await updateCurrentUser(session.token, form);
        onSessionChange({
          ...session,
          user: updatedUser
        });
        setStatus("Profile updated.");
        navigate("/chat");
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to update profile.");
      }
    });
  }

  return (
    <main className="profile-shell">
      <section className="profile-panel">
        <header className="profile-header">
          <div>
            <p className="eyebrow">Profile settings</p>
            <h1>Your profile</h1>
            <p className="auth-copy">Set a profile image and a short bio for your chat identity.</p>
          </div>
          <button className="ghost-button" type="button" onClick={() => navigate("/chat")}>
            Back to chat
          </button>
        </header>

        <form className="profile-form" onSubmit={handleSubmit}>
          <section className="profile-card">
            <div className="profile-avatar-preview">
              {form.profileImageUrl ? (
                <img alt={form.displayName || "Profile"} src={form.profileImageUrl} />
              ) : (
                <span>{form.displayName.slice(0, 1).toUpperCase() || "U"}</span>
              )}
            </div>

            <div className="profile-card-copy">
              <h2>{form.displayName || "Your profile"}</h2>
              <p>{form.bio || "Add a one-line bio to introduce yourself."}</p>
            </div>
          </section>

          <label>
            <span>Display name</span>
            <input
              value={form.displayName}
              onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
              placeholder="Your name"
              required
            />
          </label>

          <label>
            <span>Bio</span>
            <input
              maxLength={120}
              value={form.bio ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
              placeholder="One line about you"
            />
          </label>

          <label>
            <span>Profile image URL</span>
            <input
              value={form.profileImageUrl ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, profileImageUrl: event.target.value }))}
              placeholder="https://example.com/avatar.jpg"
            />
          </label>

          <label>
            <span>Upload image</span>
            <input accept="image/*" onChange={handleImageUpload} type="file" />
          </label>

          {error ? <p className="status-banner error">{error}</p> : null}
          {status ? <p className="status-banner">{status}</p> : null}

          <div className="profile-actions">
            <button className="ghost-button" type="button" onClick={() => navigate("/chat")}>
              Cancel
            </button>
            <button className="primary-button" disabled={isPending} type="submit">
              {isPending ? "Saving..." : "Save profile"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default ProfileSettingsView;
