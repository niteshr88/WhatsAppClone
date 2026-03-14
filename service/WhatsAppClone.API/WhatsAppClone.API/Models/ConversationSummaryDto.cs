namespace WhatsAppClone.API.Models
{
    public class ConversationSummaryDto
    {
        public int Id { get; set; }
        public bool IsGroup { get; set; }
        public string DisplayName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public string? LastMessageText { get; set; }
        public DateTime? LastMessageAt { get; set; }
        public List<UserSummaryDto> Participants { get; set; } = new();
    }
}
