namespace WhatsAppClone.API.Models
{
    public class MessageReceiptDto
    {
        public int Id { get; set; }
        public int ConversationId { get; set; }
        public DateTime? DeliveredAt { get; set; }
        public DateTime? ReadAt { get; set; }
    }
}
