namespace WhatsAppClone.API.Models
{
    public class FriendRequest
    {
        public int Id { get; set; }
        public string RequesterId { get; set; } = string.Empty;
        public string RecipientId { get; set; } = string.Empty;
        public FriendRequestStatus Status { get; set; } = FriendRequestStatus.Pending;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? RespondedAt { get; set; }
    }
}
