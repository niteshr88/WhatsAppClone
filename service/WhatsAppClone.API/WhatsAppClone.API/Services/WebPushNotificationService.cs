using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WebPush;
using WhatsAppClone.API.Data;
using WhatsAppClone.API.Models;

namespace WhatsAppClone.API.Services
{
    public sealed class WebPushNotificationService
    {
        private readonly AppDbContext _context;
        private readonly WebPushVapidKeyStore _vapidKeyStore;
        private readonly ILogger<WebPushNotificationService> _logger;

        public WebPushNotificationService(
            AppDbContext context,
            WebPushVapidKeyStore vapidKeyStore,
            ILogger<WebPushNotificationService> logger)
        {
            _context = context;
            _vapidKeyStore = vapidKeyStore;
            _logger = logger;
        }

        public string GetPublicKey()
        {
            return _vapidKeyStore.PublicKey;
        }

        public async Task SendChatMessageNotificationAsync(
            IEnumerable<string> recipientUserIds,
            MessageDto message,
            string senderDisplayName,
            string? senderProfileImageUrl,
            CancellationToken cancellationToken = default)
        {
            var normalizedRecipientIds = recipientUserIds
                .Where(userId => !string.IsNullOrWhiteSpace(userId))
                .Distinct(StringComparer.Ordinal)
                .ToArray();

            if (normalizedRecipientIds.Length == 0)
            {
                return;
            }

            var subscriptions = await _context.WebPushSubscriptions
                .Where(subscription => normalizedRecipientIds.Contains(subscription.UserId))
                .ToListAsync(cancellationToken);

            if (subscriptions.Count == 0)
            {
                return;
            }

            var payload = JsonSerializer.Serialize(new
            {
                title = senderDisplayName,
                body = BuildMessagePreview(message),
                icon = senderProfileImageUrl,
                badge = senderProfileImageUrl,
                tag = $"pulsechat-conversation-{message.ConversationId}",
                data = new
                {
                    url = $"/chat?conversationId={message.ConversationId}"
                }
            });

            var vapidDetails = _vapidKeyStore.CreateVapidDetails();
            var webPushClient = new WebPushClient();
            var staleSubscriptions = new List<WebPushSubscription>();

            foreach (var subscription in subscriptions)
            {
                try
                {
                    await webPushClient.SendNotificationAsync(
                        new PushSubscription(subscription.Endpoint, subscription.P256dh, subscription.Auth),
                        payload,
                        vapidDetails,
                        cancellationToken: cancellationToken);
                }
                catch (WebPushException exception) when (
                    exception.StatusCode == HttpStatusCode.Gone ||
                    exception.StatusCode == HttpStatusCode.NotFound)
                {
                    staleSubscriptions.Add(subscription);
                }
                catch (WebPushException exception)
                {
                    _logger.LogWarning(
                        exception,
                        "Failed to deliver web push notification for subscription {SubscriptionId}.",
                        subscription.Id);
                }
            }

            if (staleSubscriptions.Count > 0)
            {
                _context.WebPushSubscriptions.RemoveRange(staleSubscriptions);
                await _context.SaveChangesAsync(cancellationToken);
            }
        }

        private static string BuildMessagePreview(MessageDto message)
        {
            if (!string.IsNullOrWhiteSpace(message.Text))
            {
                return message.Text;
            }

            if (!string.IsNullOrWhiteSpace(message.MediaContentType) &&
                message.MediaContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            {
                return "Photo";
            }

            if (!string.IsNullOrWhiteSpace(message.MediaFileName))
            {
                return $"File: {message.MediaFileName}";
            }

            return "New message";
        }
    }
}
