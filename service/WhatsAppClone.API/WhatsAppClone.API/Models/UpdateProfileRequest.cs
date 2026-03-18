namespace WhatsAppClone.API.Models
{
    public class UpdateProfileRequest
    {
        public string DisplayName { get; set; } = string.Empty;
        public string? ProfileImageUrl { get; set; }
        public string? Bio { get; set; }
        public string? ChatThemePreference { get; set; }
        public string? ChatWallpaperPreference { get; set; }
    }
}
