using System.Collections.Concurrent;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using WhatsAppClone.API.Data;
using WhatsAppClone.API.Models;
using WhatsAppClone.API.Services;

namespace WhatsAppClone.API.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private static readonly ConcurrentDictionary<string, ConcurrentDictionary<string, byte>> UserConnections = new();
        private readonly AppDbContext _context;
        private readonly ConversationLifecycleService _conversationLifecycleService;

        public ChatHub(AppDbContext context, ConversationLifecycleService conversationLifecycleService)
        {
            _context = context;
            _conversationLifecycleService = conversationLifecycleService;
        }

        public static bool IsUserOnline(string userId)
        {
            return UserConnections.TryGetValue(userId, out var connections) && !connections.IsEmpty;
        }

        public static IReadOnlyCollection<string> GetConnectionIds(string userId)
        {
            return UserConnections.TryGetValue(userId, out var connections)
                ? connections.Keys.ToArray()
                : [];
        }

        public override async Task OnConnectedAsync()
        {
            var userId = GetCurrentUserId();
            var connections = UserConnections.GetOrAdd(userId, _ => new ConcurrentDictionary<string, byte>());
            var isFirstConnection = connections.TryAdd(Context.ConnectionId, 0) && connections.Count == 1;

            await _conversationLifecycleService.CleanupExpiredConversationsAsync();

            var conversationIds = await _conversationLifecycleService.ActiveConversationsQuery()
                .AsNoTracking()
                .Where(conversation => conversation.Participants.Any(participant => participant.UserId == userId))
                .Select(conversation => conversation.Id)
                .ToListAsync();

            await Clients.Caller.SendAsync("PresenceSnapshot", UserConnections.Keys.ToArray());

            foreach (var conversationId in conversationIds)
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, conversationId.ToString());

                var deliveredReceipts = await MarkConversationDeliveredAsync(conversationId, userId);

                if (deliveredReceipts.Count > 0)
                {
                    await Clients.Group(conversationId.ToString()).SendAsync("MessageReceiptsUpdated", deliveredReceipts);
                }
            }

            if (isFirstConnection)
            {
                await Clients.All.SendAsync("PresenceChanged", new
                {
                    UserId = userId,
                    IsOnline = true
                });
            }

            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = GetCurrentUserId();
            var isLastConnection = false;

            if (UserConnections.TryGetValue(userId, out var connections))
            {
                connections.TryRemove(Context.ConnectionId, out _);

                if (connections.IsEmpty)
                {
                    UserConnections.TryRemove(userId, out _);
                    isLastConnection = true;
                }
            }

            if (isLastConnection)
            {
                await Clients.All.SendAsync("PresenceChanged", new
                {
                    UserId = userId,
                    IsOnline = false
                });
            }

            await base.OnDisconnectedAsync(exception);
        }

        public async Task JoinConversation(string conversationId)
        {
            var userId = GetCurrentUserId();

            if (!int.TryParse(conversationId, out var parsedConversationId))
            {
                throw new HubException("Invalid conversation id.");
            }

            await EnsureConversationParticipant(parsedConversationId, userId);
            await Groups.AddToGroupAsync(Context.ConnectionId, conversationId);

            var deliveredReceipts = await MarkConversationDeliveredAsync(parsedConversationId, userId);

            if (deliveredReceipts.Count > 0)
            {
                await Clients.Group(conversationId).SendAsync("MessageReceiptsUpdated", deliveredReceipts);
            }
        }

        public async Task SendMessage(int conversationId, string messageText, string? clientMessageId = null)
        {
            var userId = GetCurrentUserId();
            await EnsureConversationParticipant(conversationId, userId);

            var text = messageText.Trim();

            if (string.IsNullOrWhiteSpace(text))
            {
                throw new HubException("Message text is required.");
            }

            var normalizedClientMessageId = string.IsNullOrWhiteSpace(clientMessageId)
                ? null
                : clientMessageId.Trim();

            if (!string.IsNullOrWhiteSpace(normalizedClientMessageId))
            {
                var existingMessage = await _context.Messages
                    .AsNoTracking()
                    .SingleOrDefaultAsync(message =>
                        message.ConversationId == conversationId &&
                        message.SenderId == userId &&
                        message.ClientMessageId == normalizedClientMessageId);

                if (existingMessage is not null)
                {
                    var existingSenderDisplayName = await _context.Users
                        .AsNoTracking()
                        .Where(user => user.Id == userId)
                        .Select(user => user.DisplayName)
                        .SingleAsync();

                    await Clients.Caller.SendAsync("ReceiveMessage", new
                    {
                        existingMessage.Id,
                        existingMessage.ConversationId,
                        existingMessage.SenderId,
                        existingMessage.ClientMessageId,
                        SenderDisplayName = existingSenderDisplayName,
                        existingMessage.Text,
                        existingMessage.MediaUrl,
                        existingMessage.MediaContentType,
                        existingMessage.MediaFileName,
                        existingMessage.MediaFileSize,
                        existingMessage.SentAt,
                        existingMessage.EditedAt,
                        existingMessage.DeletedAt,
                        existingMessage.DeliveredAt,
                        existingMessage.ReadAt
                    });

                    return;
                }
            }

            var senderDisplayName = await _context.Users
                .AsNoTracking()
                .Where(user => user.Id == userId)
                .Select(user => user.DisplayName)
                .SingleAsync();

            var message = new Message
            {
                ConversationId = conversationId,
                SenderId = userId,
                ClientMessageId = normalizedClientMessageId,
                Text = text,
                SentAt = DateTime.UtcNow
            };

            if (await HasOnlineRecipientAsync(conversationId, userId))
            {
                message.DeliveredAt = DateTime.UtcNow;
            }

            _context.Messages.Add(message);
            await _context.SaveChangesAsync();

            Console.WriteLine($"Broadcasting message to group {conversationId}");

            await Clients.Group(conversationId.ToString())
                .SendAsync("ReceiveMessage", new
                {
                    message.Id,
                    message.ConversationId,
                    message.SenderId,
                    message.ClientMessageId,
                    SenderDisplayName = senderDisplayName,
                    message.Text,
                    message.MediaUrl,
                    message.MediaContentType,
                    message.MediaFileName,
                    message.MediaFileSize,
                    message.SentAt,
                    message.EditedAt,
                    message.DeletedAt,
                    message.DeliveredAt,
                    message.ReadAt
                });
        }

        public async Task LeaveConversation(string conversationId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, conversationId);
        }

        public async Task MarkConversationRead(string conversationId)
        {
            var userId = GetCurrentUserId();

            if (!int.TryParse(conversationId, out var parsedConversationId))
            {
                throw new HubException("Invalid conversation id.");
            }

            await EnsureConversationParticipant(parsedConversationId, userId);

            var readReceipts = await MarkConversationReadAsync(parsedConversationId, userId);

            if (readReceipts.Count > 0)
            {
                await Clients.Group(conversationId).SendAsync("MessageReceiptsUpdated", readReceipts);
            }
        }

        public async Task StartTyping(string conversationId)
        {
            var userId = GetCurrentUserId();

            if (!int.TryParse(conversationId, out var parsedConversationId))
            {
                throw new HubException("Invalid conversation id.");
            }

            await EnsureConversationParticipant(parsedConversationId, userId);

            var displayName = await _context.Users
                .AsNoTracking()
                .Where(user => user.Id == userId)
                .Select(user => user.DisplayName)
                .SingleAsync();

            await Clients.OthersInGroup(conversationId).SendAsync("TypingStarted", new
            {
                ConversationId = parsedConversationId,
                UserId = userId,
                DisplayName = displayName
            });
        }

        public async Task StopTyping(string conversationId)
        {
            var userId = GetCurrentUserId();

            if (!int.TryParse(conversationId, out var parsedConversationId))
            {
                throw new HubException("Invalid conversation id.");
            }

            await EnsureConversationParticipant(parsedConversationId, userId);

            await Clients.OthersInGroup(conversationId).SendAsync("TypingStopped", new
            {
                ConversationId = parsedConversationId,
                UserId = userId
            });
        }

        private string GetCurrentUserId()
        {
            var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(userId))
            {
                throw new HubException("Unauthorized connection.");
            }

            return userId;
        }

        private async Task EnsureConversationParticipant(int conversationId, string userId)
        {
            var isAccessible = await _conversationLifecycleService.IsConversationAccessibleAsync(conversationId, userId);

            if (!isAccessible)
            {
                throw new HubException("You are not a participant in this conversation.");
            }
        }

        private async Task<bool> HasOnlineRecipientAsync(int conversationId, string senderId)
        {
            var participantIds = await _context.ConversationParticipants
                .AsNoTracking()
                .Where(participant => participant.ConversationId == conversationId && participant.UserId != senderId)
                .Select(participant => participant.UserId)
                .ToListAsync();

            return participantIds.Any(IsUserOnline);
        }

        private async Task<List<MessageReceiptDto>> MarkConversationDeliveredAsync(int conversationId, string userId)
        {
            var timestamp = DateTime.UtcNow;
            var messages = await _context.Messages
                .Where(message =>
                    message.ConversationId == conversationId &&
                    message.SenderId != userId &&
                    message.DeliveredAt == null)
                .ToListAsync();

            if (messages.Count == 0)
            {
                return [];
            }

            foreach (var message in messages)
            {
                message.DeliveredAt = timestamp;
            }

            await _context.SaveChangesAsync();

            return messages
                .Select(message => new MessageReceiptDto
                {
                    Id = message.Id,
                    ConversationId = message.ConversationId,
                    DeliveredAt = message.DeliveredAt,
                    ReadAt = message.ReadAt
                })
                .ToList();
        }

        private async Task<List<MessageReceiptDto>> MarkConversationReadAsync(int conversationId, string userId)
        {
            var timestamp = DateTime.UtcNow;
            var messages = await _context.Messages
                .Where(message =>
                    message.ConversationId == conversationId &&
                    message.SenderId != userId &&
                    message.ReadAt == null)
                .ToListAsync();

            if (messages.Count == 0)
            {
                return [];
            }

            foreach (var message in messages)
            {
                message.DeliveredAt ??= timestamp;
                message.ReadAt = timestamp;
            }

            await _context.SaveChangesAsync();

            return messages
                .Select(message => new MessageReceiptDto
                {
                    Id = message.Id,
                    ConversationId = message.ConversationId,
                    DeliveredAt = message.DeliveredAt,
                    ReadAt = message.ReadAt
                })
                .ToList();
        }
    }
}

