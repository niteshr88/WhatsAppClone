namespace WhatsAppClone.API.Models
{
    public class UserSummaryDto
    {
        public string Id { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string? ProfileImageUrl { get; set; }
        public string? Bio { get; set; }
        public string FriendshipStatus { get; set; } = "none";
        public int? FriendshipRequestId { get; set; }
    }
}
