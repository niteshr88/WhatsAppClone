namespace WhatsAppClone.API.Models
{
    public class ForgotPasswordResponse
    {
        public string Email { get; set; } = string.Empty;
        public string ResetToken { get; set; } = string.Empty;
    }
}
