using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using WhatsAppClone.API.Data;
using WhatsAppClone.API.Hubs;
using WhatsAppClone.API.Models;
using WhatsAppClone.API.Services;

namespace WhatsAppClone.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class MessagesController : ControllerBase
    {
        private const long MaxMediaFileSize = 20 * 1024 * 1024;
        private readonly AppDbContext _context;
        private readonly IHubContext<ChatHub> _hubContext;
        private readonly IWebHostEnvironment _environment;
        private readonly WebPushNotificationService _webPushNotificationService;
        private readonly ConversationLifecycleService _conversationLifecycleService;

        public MessagesController(
            AppDbContext context,
            IHubContext<ChatHub> hubContext,
            IWebHostEnvironment environment,
            WebPushNotificationService webPushNotificationService,
            ConversationLifecycleService conversationLifecycleService)
        {
            _context = context;
            _hubContext = hubContext;
            _environment = environment;
            _webPushNotificationService = webPushNotificationService;
            _conversationLifecycleService = conversationLifecycleService;
        }

        [HttpGet("conversation/{conversationId:int}")]
        public async Task<ActionResult<IEnumerable<MessageDto>>> GetMessages(int conversationId)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(currentUserId))
            {
                return Unauthorized();
            }

            if (!await _conversationLifecycleService.IsConversationAccessibleAsync(conversationId, currentUserId))
            {
                return NotFound();
            }

            var messages = await _context.Messages
                .AsNoTracking()
                .Where(message => message.ConversationId == conversationId)
                .OrderBy(message => message.SentAt)
                .Join(
                    _context.Users.AsNoTracking(),
                    message => message.SenderId,
                    user => user.Id,
                    (message, user) => new MessageDto
                    {
                        Id = message.Id,
                        ConversationId = message.ConversationId,
                        SenderId = message.SenderId,
                        ClientMessageId = message.ClientMessageId,
                        SenderDisplayName = user.DisplayName,
                        Text = message.Text,
                        MediaUrl = message.MediaUrl,
                        MediaContentType = message.MediaContentType,
                        MediaFileName = message.MediaFileName,
                        MediaFileSize = message.MediaFileSize,
                        SentAt = message.SentAt,
                        EditedAt = message.EditedAt,
                        DeletedAt = message.DeletedAt,
                        DeliveredAt = message.DeliveredAt,
                        ReadAt = message.ReadAt
                    })
                .ToListAsync();

            return Ok(messages);
        }

        [HttpPost]
        public async Task<ActionResult<MessageDto>> CreateMessage(CreateMessageRequest request)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(currentUserId))
            {
                return Unauthorized();
            }

            if (!await _conversationLifecycleService.IsConversationAccessibleAsync(request.ConversationId, currentUserId))
            {
                return NotFound();
            }

            var text = request.Text.Trim();

            if (string.IsNullOrWhiteSpace(text))
            {
                return BadRequest("Message text is required.");
            }

            var clientMessageId = string.IsNullOrWhiteSpace(request.ClientMessageId)
                ? null
                : request.ClientMessageId.Trim();

            if (!string.IsNullOrWhiteSpace(clientMessageId))
            {
                var existingMessage = await _context.Messages
                    .AsNoTracking()
                    .SingleOrDefaultAsync(message =>
                        message.ConversationId == request.ConversationId &&
                        message.SenderId == currentUserId &&
                        message.ClientMessageId == clientMessageId);

                if (existingMessage is not null)
                {
                    return Ok(await BuildMessageDtoAsync(existingMessage));
                }
            }

            var message = new Message
            {
                ConversationId = request.ConversationId,
                SenderId = currentUserId,
                ClientMessageId = clientMessageId,
                Text = text,
                SentAt = DateTime.UtcNow
            };

            var recipientIds = await _context.ConversationParticipants
                .AsNoTracking()
                .Where(participant => participant.ConversationId == request.ConversationId && participant.UserId != currentUserId)
                .Select(participant => participant.UserId)
                .ToListAsync();

            if (recipientIds.Any(ChatHub.IsUserOnline))
            {
                message.DeliveredAt = DateTime.UtcNow;
            }

            _context.Messages.Add(message);
            await _context.SaveChangesAsync();

            var payload = await BuildMessageDtoAsync(message);
            await _hubContext.Clients.Group(message.ConversationId.ToString()).SendAsync("ReceiveMessage", payload);
            await SendWebPushToOfflineRecipientsAsync(recipientIds, payload, currentUserId);

            return Ok(payload);
        }

        [HttpPut("{messageId:int}")]
        public async Task<ActionResult<MessageDto>> UpdateMessage(int messageId, UpdateMessageRequest request)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(currentUserId))
            {
                return Unauthorized();
            }

            var message = await _context.Messages.SingleOrDefaultAsync(candidate => candidate.Id == messageId);

            if (message is null)
            {
                return NotFound();
            }

            if (!string.Equals(message.SenderId, currentUserId, StringComparison.Ordinal))
            {
                return Forbid();
            }

            if (message.DeletedAt is not null)
            {
                return BadRequest("Deleted messages cannot be edited.");
            }

            if (!string.IsNullOrWhiteSpace(message.MediaUrl))
            {
                return BadRequest("Media messages cannot be edited.");
            }

            var text = request.Text.Trim();

            if (string.IsNullOrWhiteSpace(text))
            {
                return BadRequest("Message text is required.");
            }

            message.Text = text;
            message.EditedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var payload = await BuildMessageDtoAsync(message);
            await _hubContext.Clients.Group(message.ConversationId.ToString()).SendAsync("MessageUpdated", payload);

            return Ok(payload);
        }

        [HttpDelete("{messageId:int}")]
        public async Task<ActionResult<MessageDto>> DeleteMessage(int messageId)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(currentUserId))
            {
                return Unauthorized();
            }

            var message = await _context.Messages.SingleOrDefaultAsync(candidate => candidate.Id == messageId);

            if (message is null)
            {
                return NotFound();
            }

            if (!string.Equals(message.SenderId, currentUserId, StringComparison.Ordinal))
            {
                return Forbid();
            }

            if (message.DeletedAt is null)
            {
                message.Text = Message.DeletedPlaceholder;
                message.DeletedAt = DateTime.UtcNow;
                message.EditedAt = null;
                message.MediaUrl = null;
                message.MediaContentType = null;
                message.MediaFileName = null;
                message.MediaFileSize = null;
                await _context.SaveChangesAsync();
            }

            var payload = await BuildMessageDtoAsync(message);
            await _hubContext.Clients.Group(message.ConversationId.ToString()).SendAsync("MessageDeleted", payload);

            return Ok(payload);
        }

        [HttpPost("conversation/{conversationId:int}/read")]
        public async Task<IActionResult> MarkConversationRead(int conversationId)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(currentUserId))
            {
                return Unauthorized();
            }

            if (!await _conversationLifecycleService.IsConversationAccessibleAsync(conversationId, currentUserId))
            {
                return NotFound();
            }

            var timestamp = DateTime.UtcNow;
            var messages = await _context.Messages
                .Where(message =>
                    message.ConversationId == conversationId &&
                    message.SenderId != currentUserId &&
                    message.ReadAt == null)
                .ToListAsync();

            if (messages.Count == 0)
            {
                return NoContent();
            }

            foreach (var message in messages)
            {
                message.DeliveredAt ??= timestamp;
                message.ReadAt = timestamp;
            }

            await _context.SaveChangesAsync();

            await _hubContext.Clients.Group(conversationId.ToString()).SendAsync(
                "MessageReceiptsUpdated",
                messages.Select(message => new MessageReceiptDto
                {
                    Id = message.Id,
                    ConversationId = message.ConversationId,
                    DeliveredAt = message.DeliveredAt,
                    ReadAt = message.ReadAt
                }).ToList());

            return NoContent();
        }

        [HttpPost("media")]
        [RequestSizeLimit(MaxMediaFileSize)]
        public async Task<ActionResult<MessageDto>> UploadMedia([FromForm] UploadMessageMediaRequest request)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(currentUserId))
            {
                return Unauthorized();
            }

            if (request.File is null || request.File.Length == 0)
            {
                return BadRequest("A file is required.");
            }

            if (request.File.Length > MaxMediaFileSize)
            {
                return BadRequest("Files must be 20 MB or smaller.");
            }

            if (!await _conversationLifecycleService.IsConversationAccessibleAsync(request.ConversationId, currentUserId))
            {
                return NotFound();
            }

            var originalFileName = Path.GetFileName(request.File.FileName);

            if (string.IsNullOrWhiteSpace(originalFileName))
            {
                return BadRequest("The uploaded file must have a name.");
            }

            var clientMessageId = string.IsNullOrWhiteSpace(request.ClientMessageId)
                ? null
                : request.ClientMessageId.Trim();

            if (!string.IsNullOrWhiteSpace(clientMessageId))
            {
                var existingMessage = await _context.Messages
                    .AsNoTracking()
                    .SingleOrDefaultAsync(message =>
                        message.ConversationId == request.ConversationId &&
                        message.SenderId == currentUserId &&
                        message.ClientMessageId == clientMessageId);

                if (existingMessage is not null)
                {
                    return Ok(await BuildMessageDtoAsync(existingMessage));
                }
            }

            var safeExtension = Path.GetExtension(originalFileName);
            var safeFileName = $"{Guid.NewGuid():N}{safeExtension}";
            var mediaDirectory = Path.Combine(_environment.WebRootPath ?? Path.Combine(_environment.ContentRootPath, "wwwroot"), "uploads", "chat-media");
            Directory.CreateDirectory(mediaDirectory);

            var filePath = Path.Combine(mediaDirectory, safeFileName);

            await using (var stream = System.IO.File.Create(filePath))
            {
                await request.File.CopyToAsync(stream);
            }

            var message = new Message
            {
                ConversationId = request.ConversationId,
                SenderId = currentUserId,
                ClientMessageId = clientMessageId,
                Text = string.Empty,
                MediaUrl = $"/uploads/chat-media/{safeFileName}",
                MediaContentType = string.IsNullOrWhiteSpace(request.File.ContentType)
                    ? "application/octet-stream"
                    : request.File.ContentType,
                MediaFileName = originalFileName,
                MediaFileSize = request.File.Length,
                SentAt = DateTime.UtcNow
            };

            var recipientIds = await _context.ConversationParticipants
                .AsNoTracking()
                .Where(participant => participant.ConversationId == request.ConversationId && participant.UserId != currentUserId)
                .Select(participant => participant.UserId)
                .ToListAsync();

            if (recipientIds.Any(ChatHub.IsUserOnline))
            {
                message.DeliveredAt = DateTime.UtcNow;
            }

            _context.Messages.Add(message);
            await _context.SaveChangesAsync();

            var payload = await BuildMessageDtoAsync(message);
            await _hubContext.Clients.Group(message.ConversationId.ToString()).SendAsync("ReceiveMessage", payload);
            await SendWebPushToOfflineRecipientsAsync(recipientIds, payload, currentUserId);

            return Ok(payload);
        }

        private async Task<MessageDto> BuildMessageDtoAsync(Message message)
        {
            var senderDisplayName = await _context.Users
                .AsNoTracking()
                .Where(user => user.Id == message.SenderId)
                .Select(user => user.DisplayName)
                .SingleAsync();

            return new MessageDto
            {
                Id = message.Id,
                ConversationId = message.ConversationId,
                SenderId = message.SenderId,
                ClientMessageId = message.ClientMessageId,
                SenderDisplayName = senderDisplayName,
                Text = message.Text,
                MediaUrl = message.MediaUrl,
                MediaContentType = message.MediaContentType,
                MediaFileName = message.MediaFileName,
                MediaFileSize = message.MediaFileSize,
                SentAt = message.SentAt,
                EditedAt = message.EditedAt,
                DeletedAt = message.DeletedAt,
                DeliveredAt = message.DeliveredAt,
                ReadAt = message.ReadAt
            };
        }

        private async Task SendWebPushToOfflineRecipientsAsync(
            IEnumerable<string> recipientIds,
            MessageDto payload,
            string senderId)
        {
            var offlineRecipientIds = recipientIds
                .Where(recipientId => !ChatHub.IsUserOnline(recipientId))
                .Distinct(StringComparer.Ordinal)
                .ToArray();

            if (offlineRecipientIds.Length == 0)
            {
                return;
            }

            var senderProfileImageUrl = await _context.Users
                .AsNoTracking()
                .Where(user => user.Id == senderId)
                .Select(user => user.ProfileImageUrl)
                .SingleOrDefaultAsync();

            await _webPushNotificationService.SendChatMessageNotificationAsync(
                offlineRecipientIds,
                payload,
                payload.SenderDisplayName,
                senderProfileImageUrl);
        }
    }
}
