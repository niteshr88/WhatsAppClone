namespace WhatsAppClone.API.Models
{
    public class UpdateGroupSettingsRequest
    {
        public string GroupName { get; set; } = string.Empty;
        public string? GroupImageUrl { get; set; }
        public string? GroupRules { get; set; }
    }
}
