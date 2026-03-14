using Microsoft.AspNetCore.Http;

namespace WhatsAppClone.API.Models
{
    public class UploadMessageMediaRequest
    {
        public int ConversationId { get; set; }
        public string? ClientMessageId { get; set; }
        public IFormFile? File { get; set; }
    }
}
