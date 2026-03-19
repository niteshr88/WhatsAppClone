import type { ChangeEvent, FormEvent } from "react";
import { resolveMediaUrl } from "../../api";
import type { AuthUser, Conversation, UpdateGroupSettingsRequest } from "../../types";
import { initials } from "../../utils/chat";

type GroupSettingsModalProps = {
  conversation: Conversation;
  availableContacts: AuthUser[];
  selectedParticipantIds: string[];
  form: UpdateGroupSettingsRequest;
  error: string;
  status: string;
  isSaving: boolean;
  canManage: boolean;
  onlineUserIds: ReadonlySet<string>;
  onClose: () => void;
  onFormChange: (field: keyof UpdateGroupSettingsRequest, value: string) => void;
  onGroupImageUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onToggleParticipant: (participantId: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onAddParticipants: () => void | Promise<void>;
  onRemoveParticipant: (participantId: string) => void | Promise<void>;
};

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

function RemoveUserIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 20 20">
      <path d="M5.5 5.5 14.5 14.5M14.5 5.5l-9 9" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function GroupSettingsModal({
  conversation,
  availableContacts,
  selectedParticipantIds,
  form,
  error,
  status,
  isSaving,
  canManage,
  onlineUserIds,
  onClose,
  onFormChange,
  onGroupImageUpload,
  onToggleParticipant,
  onSave,
  onAddParticipants,
  onRemoveParticipant
}: GroupSettingsModalProps) {
  const previewImage = resolveMediaUrl(form.groupImageUrl ?? conversation.groupImageUrl);
  const groupStatus = conversation.isTemporary ? "Temporary group" : "Permanent group";
  const expiryText = conversation.expiresAt
    ? `Expires ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(conversation.expiresAt))}`
    : "Stays until the admin deletes it.";

  return (
    <div className="group-modal-backdrop" role="presentation" onClick={onClose}>
      <div aria-labelledby="group-settings-title" aria-modal="true" className="group-modal group-settings-modal" role="dialog" onClick={(event) => event.stopPropagation()}>
        <div className="group-modal-header group-settings-header">
          <div>
            <p className="eyebrow">Group settings</p>
            <h3 id="group-settings-title">{conversation.displayName}</h3>
            <p className="group-settings-subtitle">{groupStatus} � {expiryText}</p>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <form className="group-modal-form group-settings-form" onSubmit={onSave}>
          <div className="group-settings-hero">
            <div className="group-settings-avatar-shell">
              <span className="avatar-badge group-settings-avatar">
                {previewImage ? <img alt={conversation.displayName} className="avatar-image" src={previewImage} /> : initials(form.groupName || conversation.displayName)}
              </span>
              {canManage ? (
                <label className="group-settings-image-trigger">
                  <input accept="image/*" className="sidebar-profile-image-input" type="file" onChange={onGroupImageUpload} />
                  <CameraIcon className="sidebar-profile-image-icon" />
                </label>
              ) : null}
            </div>

            <div className="group-settings-hero-copy">
              <span className="status-pill">{conversation.participants.length} participants</span>
              {conversation.isTemporary ? <span className="status-pill">Temporary</span> : <span className="status-pill">Permanent</span>}
            </div>
          </div>

          <div className="group-settings-grid">
            <label>
              <span>Group name</span>
              <input
                disabled={!canManage || isSaving}
                maxLength={60}
                placeholder="Group name"
                required
                value={form.groupName}
                onChange={(event) => onFormChange("groupName", event.target.value)}
              />
            </label>

            <label>
              <span>Rules</span>
              <textarea
                disabled={!canManage || isSaving}
                maxLength={500}
                placeholder="Add some simple group rules..."
                rows={4}
                value={form.groupRules ?? ""}
                onChange={(event) => onFormChange("groupRules", event.target.value)}
              />
            </label>
          </div>

          <section className="group-settings-section">
            <div className="section-heading inner dark">
              <span>Members</span>
              <span>{conversation.participants.length}</span>
            </div>
            <div className="group-settings-member-list">
              {conversation.participants.map((participant) => {
                const isOnline = onlineUserIds.has(participant.id);
                const profileImageUrl = resolveMediaUrl(participant.profileImageUrl);
                const isAdminMember = participant.id === conversation.adminUserId;

                return (
                  <article key={participant.id} className="group-settings-member-card">
                    <span className={`avatar-badge ${isOnline ? "live" : ""}`}>
                      {profileImageUrl ? <img alt={participant.displayName} className="avatar-image" src={profileImageUrl} /> : initials(participant.displayName)}
                      <span className={`presence-dot ${isOnline ? "online" : ""}`} />
                    </span>
                    <span className="group-member-copy">
                      <strong>{participant.displayName}</strong>
                      <small>{isAdminMember ? "Admin" : participant.email}</small>
                    </span>
                    {canManage && !isAdminMember ? (
                      <button className="group-member-remove" type="button" onClick={() => void onRemoveParticipant(participant.id)}>
                        <RemoveUserIcon className="group-member-remove-icon" />
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>

          {canManage ? (
            <section className="group-settings-section">
              <div className="section-heading inner dark">
                <span>Add people</span>
                <span>{selectedParticipantIds.length} selected</span>
              </div>
              {availableContacts.length ? (
                <>
                  <div className="group-member-list compact">
                    {availableContacts.map((contact) => {
                      const isSelected = selectedParticipantIds.includes(contact.id);
                      const isOnline = onlineUserIds.has(contact.id);
                      const profileImageUrl = resolveMediaUrl(contact.profileImageUrl);

                      return (
                        <label key={contact.id} className={`group-member-card ${isSelected ? "selected" : ""}`}>
                          <input checked={isSelected} type="checkbox" onChange={() => onToggleParticipant(contact.id)} />
                          <span className={`avatar-badge ${isOnline ? "live" : ""}`}>
                            {profileImageUrl ? <img alt={contact.displayName} className="avatar-image" src={profileImageUrl} /> : initials(contact.displayName)}
                            <span className={`presence-dot ${isOnline ? "online" : ""}`} />
                          </span>
                          <span className="group-member-copy">
                            <strong>{contact.displayName}</strong>
                            <small>{contact.email}</small>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="group-settings-inline-actions">
                    <button className="ghost-button" disabled={!selectedParticipantIds.length || isSaving} type="button" onClick={() => void onAddParticipants()}>
                      Add selected
                    </button>
                  </div>
                </>
              ) : (
                <div className="sidebar-empty group-settings-empty">
                  <p>Everyone available is already in this group.</p>
                </div>
              )}
            </section>
          ) : null}

          {error ? <p className="status-banner error">{error}</p> : null}
          {status ? <p className="status-banner">{status}</p> : null}

          <div className="group-modal-actions group-settings-actions">
            <button className="ghost-button" type="button" onClick={onClose}>
              Close
            </button>
            {canManage ? (
              <button className="primary-button" disabled={isSaving} type="submit">
                {isSaving ? "Saving..." : "Save changes"}
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}

export default GroupSettingsModal;
