namespace WhatsAppClone.API.Models
{
    public class MessagePageDto
    {
        public List<MessageDto> Items { get; set; } = [];
        public bool HasOlder { get; set; }
    }
}
