using Microsoft.AspNetCore.Identity;

namespace WhatsAppClone.API.Models
{
    public class ApplicationUser : IdentityUser
    {
        public string DisplayName { get; set; } = string.Empty;
        public string? ProfileImageUrl { get; set; }
        public string? Bio { get; set; }
    }
}
