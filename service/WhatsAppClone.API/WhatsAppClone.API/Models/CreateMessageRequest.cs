namespace WhatsAppClone.API.Models
{
    public class CreateMessageRequest
    {
        public int ConversationId { get; set; }
        public string? ClientMessageId { get; set; }
        public string Text { get; set; } = string.Empty;
    }
}
