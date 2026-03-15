namespace WhatsAppClone.API.Models
{
    public class ConversationSummaryDto
    {
        public int Id { get; set; }
        public bool IsGroup { get; set; }
        public string DisplayName { get; set; } = string.Empty;
        public string? GroupName { get; set; }
        public string? AdminUserId { get; set; }
        public bool IsTemporary { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public bool CanManage { get; set; }
        public DateTime CreatedAt { get; set; }
        public string? LastMessageText { get; set; }
        public DateTime? LastMessageAt { get; set; }
        public List<UserSummaryDto> Participants { get; set; } = new();
    }
}
