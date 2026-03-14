namespace WhatsAppClone.API.Models
{
    public class Message
    {
        public const string DeletedPlaceholder = "This message was deleted.";

        public int Id { get; set; }
        public int ConversationId { get; set; }
        public string SenderId { get; set; } = string.Empty;
        public string? ClientMessageId { get; set; }
        public string Text { get; set; } = string.Empty;
        public string? MediaUrl { get; set; }
        public string? MediaContentType { get; set; }
        public string? MediaFileName { get; set; }
        public long? MediaFileSize { get; set; }
        public DateTime SentAt { get; set; } = DateTime.UtcNow;
        public DateTime? EditedAt { get; set; }
        public DateTime? DeletedAt { get; set; }
        public DateTime? DeliveredAt { get; set; }
        public DateTime? ReadAt { get; set; }
        public Conversation? Conversation { get; set; }

        public string GetPreviewText()
        {
            if (DeletedAt is not null)
            {
                return DeletedPlaceholder;
            }

            if (!string.IsNullOrWhiteSpace(Text))
            {
                return Text;
            }

            if (!string.IsNullOrWhiteSpace(MediaContentType) &&
                MediaContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            {
                return "Photo";
            }

            if (!string.IsNullOrWhiteSpace(MediaFileName))
            {
                return $"File: {MediaFileName}";
            }

            if (!string.IsNullOrWhiteSpace(MediaUrl))
            {
                return "Attachment";
            }

            return string.Empty;
        }
    }
}
