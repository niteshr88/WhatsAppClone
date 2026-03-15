namespace WhatsAppClone.API.Models
{
    public class UpdateConversationParticipantsRequest
    {
        public List<string> ParticipantIds { get; set; } = new();
    }
}
