namespace WhatsAppClone.API.Models
{
    public class MessageDto
    {
        public int Id { get; set; }
        public int ConversationId { get; set; }
        public string SenderId { get; set; } = string.Empty;
        public string? ClientMessageId { get; set; }
        public string SenderDisplayName { get; set; } = string.Empty;
        public string Text { get; set; } = string.Empty;
        public string? MediaUrl { get; set; }
        public string? MediaContentType { get; set; }
        public string? MediaFileName { get; set; }
        public long? MediaFileSize { get; set; }
        public DateTime SentAt { get; set; }
        public DateTime? EditedAt { get; set; }
        public DateTime? DeletedAt { get; set; }
        public DateTime? DeliveredAt { get; set; }
        public DateTime? ReadAt { get; set; }
    }
}
