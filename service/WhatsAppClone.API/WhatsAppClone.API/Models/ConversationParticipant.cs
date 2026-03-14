namespace WhatsAppClone.API.Models
{
    public class ConversationParticipant
    {
        public int Id { get; set; }
        public int ConversationId { get; set; }
        public string UserId { get; set; } = string.Empty;

        public Conversation Conversation { get; set; } = null!;
        public ApplicationUser User { get; set; } = null!;
    }
}
