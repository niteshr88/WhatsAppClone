namespace WhatsAppClone.API.Models
{
    public class CreateConversationRequest
    {
        public List<string> ParticipantIds { get; set; } = new();
    }
}
