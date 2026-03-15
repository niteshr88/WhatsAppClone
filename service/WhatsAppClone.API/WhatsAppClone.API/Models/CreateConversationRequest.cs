namespace WhatsAppClone.API.Models
{
    public class CreateConversationRequest
    {
        public List<string> ParticipantIds { get; set; } = new();
        public string? GroupName { get; set; }
        public bool IsTemporary { get; set; }
        public int? ExpiresInHours { get; set; }
    }
}
