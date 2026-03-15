namespace WhatsAppClone.API.Models
{
    public class Conversation
    {
        public int Id { get; set; }
        public bool IsGroup { get; set; }
        public string? Name { get; set; }
        public string? AdminUserId { get; set; }
        public string? GroupImageUrl { get; set; }
        public string? GroupRules { get; set; }
        public bool IsTemporary { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public ICollection<ConversationParticipant> Participants { get; set; } = new List<ConversationParticipant>();
        public ICollection<Message> Messages { get; set; } = new List<Message>();
    }
}
