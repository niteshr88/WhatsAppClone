namespace WhatsAppClone.API.Models
{
    public class FriendshipUpdateDto
    {
        public string UserId { get; set; } = string.Empty;
        public string FriendshipStatus { get; set; } = "none";
        public int? FriendshipRequestId { get; set; }
    }
}
