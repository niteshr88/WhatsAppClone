using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using WhatsAppClone.API.Data;
using WhatsAppClone.API.Hubs;
using WhatsAppClone.API.Models;
using WhatsAppClone.API.Services;

namespace WhatsAppClone.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ConversationsController : ControllerBase
    {
        private const int MaxTemporaryGroupLifetimeHours = 24 * 30;
        private readonly AppDbContext _context;
        private readonly IHubContext<ChatHub> _hubContext;
        private readonly ConversationLifecycleService _conversationLifecycleService;

        public ConversationsController(
            AppDbContext context,
            IHubContext<ChatHub> hubContext,
            ConversationLifecycleService conversationLifecycleService)
        {
            _context = context;
            _hubContext = hubContext;
            _conversationLifecycleService = conversationLifecycleService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<ConversationSummaryDto>>> GetConversations()
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(currentUserId))
            {
                return Unauthorized();
            }

            await _conversationLifecycleService.CleanupExpiredConversationsAsync();

            var conversations = await _conversationLifecycleService.ActiveConversationsQuery()
                .AsNoTracking()
                .Where(conversation => conversation.Participants.Any(participant => participant.UserId == currentUserId))
                .Include(conversation => conversation.Participants)
                .ThenInclude(participant => participant.User)
                .ToListAsync();

            var conversationIds = conversations.Select(conversation => conversation.Id).ToList();
            var lastMessageLookup = await BuildLastMessageLookup(conversationIds);

            return Ok(conversations
                .Select(conversation => ToSummary(conversation, currentUserId, lastMessageLookup.GetValueOrDefault(conversation.Id)))
                .OrderByDescending(conversation => conversation.LastMessageAt ?? conversation.CreatedAt)
                .ToList());
        }

        [HttpPost]
        public async Task<ActionResult<ConversationSummaryDto>> CreateConversation(CreateConversationRequest request)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(currentUserId))
            {
                return Unauthorized();
            }

            await _conversationLifecycleService.CleanupExpiredConversationsAsync();

            var participantIds = request.ParticipantIds
                .Where(participantId => !string.IsNullOrWhiteSpace(participantId))
                .Select(participantId => participantId.Trim())
                .Append(currentUserId)
                .Distinct(StringComparer.Ordinal)
                .ToList();

            if (participantIds.Count < 2)
            {
                return BadRequest("At least one participant is required.");
            }

            var users = await _context.Users
                .AsNoTracking()
                .Where(user => participantIds.Contains(user.Id))
                .ToListAsync();

            if (users.Count != participantIds.Count)
            {
                return BadRequest("One or more participants do not exist.");
            }

            var trimmedGroupName = request.GroupName?.Trim();
            var isGroupConversation =
                participantIds.Count > 2 ||
                !string.IsNullOrWhiteSpace(trimmedGroupName) ||
                request.IsTemporary ||
                request.ExpiresInHours.HasValue;

            if (!isGroupConversation)
            {
                var otherUserId = participantIds.Single(participantId => participantId != currentUserId);

                var existingConversationId = await _conversationLifecycleService.ActiveConversationsQuery()
                    .AsNoTracking()
                    .Where(conversation => !conversation.IsGroup)
                    .Where(conversation => conversation.Participants.Count == 2)
                    .Where(conversation => conversation.Participants.Any(participant => participant.UserId == currentUserId))
                    .Where(conversation => conversation.Participants.Any(participant => participant.UserId == otherUserId))
                    .Select(conversation => (int?)conversation.Id)
                    .FirstOrDefaultAsync();

                if (existingConversationId.HasValue)
                {
                    return Ok(await BuildConversationSummary(existingConversationId.Value, currentUserId));
                }
            }
            else
            {
                if (participantIds.Count < 3)
                {
                    return BadRequest("Group chats need at least three participants including you.");
                }

                if (string.IsNullOrWhiteSpace(trimmedGroupName))
                {
                    return BadRequest("Group name is required.");
                }
            }

            DateTime? expiresAt = null;

            if (request.IsTemporary)
            {
                if (!request.ExpiresInHours.HasValue || request.ExpiresInHours.Value < 1)
                {
                    return BadRequest("Temporary groups need a lifetime of at least 1 hour.");
                }

                if (request.ExpiresInHours.Value > MaxTemporaryGroupLifetimeHours)
                {
                    return BadRequest($"Temporary groups can last at most {MaxTemporaryGroupLifetimeHours} hours.");
                }

                expiresAt = DateTime.UtcNow.AddHours(request.ExpiresInHours.Value);
            }

            var conversation = new Conversation
            {
                IsGroup = isGroupConversation,
                Name = isGroupConversation ? trimmedGroupName : null,
                AdminUserId = isGroupConversation ? currentUserId : null,
                IsTemporary = isGroupConversation && request.IsTemporary,
                ExpiresAt = isGroupConversation ? expiresAt : null,
                Participants = participantIds
                    .Select(participantId => new ConversationParticipant
                    {
                        UserId = participantId
                    })
                    .ToList()
            };

            _context.Conversations.Add(conversation);
            await _context.SaveChangesAsync();

            await AddUsersToConversationGroupAsync(conversation.Id, participantIds);

            var summary = await BuildConversationSummary(conversation.Id, currentUserId);
            await NotifyConversationCreated(conversation.Id, participantIds);
            return CreatedAtAction(nameof(GetConversation), new { conversationId = conversation.Id }, summary);
        }

        [HttpGet("{conversationId:int}")]
        public async Task<ActionResult<ConversationSummaryDto>> GetConversation(int conversationId)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(currentUserId))
            {
                return Unauthorized();
            }

            var isAccessible = await _conversationLifecycleService.IsConversationAccessibleAsync(conversationId, currentUserId);

            if (!isAccessible)
            {
                return NotFound();
            }

            return Ok(await BuildConversationSummary(conversationId, currentUserId));
        }

        [HttpPut("{conversationId:int}/settings")]
        public async Task<ActionResult<ConversationSummaryDto>> UpdateGroupSettings(int conversationId, UpdateGroupSettingsRequest request)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(currentUserId))
            {
                return Unauthorized();
            }

            await _conversationLifecycleService.CleanupExpiredConversationsAsync();

            var conversation = await GetManageableGroupConversation(conversationId, currentUserId);

            if (conversation is null)
            {
                return NotFound();
            }

            var trimmedName = request.GroupName.Trim();

            if (string.IsNullOrWhiteSpace(trimmedName))
            {
                return BadRequest("Group name is required.");
            }

            conversation.Name = trimmedName;
            conversation.GroupImageUrl = NormalizeOptionalText(request.GroupImageUrl);
            conversation.GroupRules = NormalizeOptionalText(request.GroupRules);

            await _context.SaveChangesAsync();

            var participantIds = conversation.Participants
                .Select(participant => participant.UserId)
                .Distinct(StringComparer.Ordinal)
                .ToList();

            await NotifyConversationUpdated(conversation.Id, participantIds);
            return Ok(await BuildConversationSummary(conversation.Id, currentUserId));
        }

        [HttpPost("{conversationId:int}/participants")]
        public async Task<ActionResult<ConversationSummaryDto>> AddParticipants(int conversationId, UpdateConversationParticipantsRequest request)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(currentUserId))
            {
                return Unauthorized();
            }

            await _conversationLifecycleService.CleanupExpiredConversationsAsync();

            var conversation = await GetManageableGroupConversation(conversationId, currentUserId);

            if (conversation is null)
            {
                return NotFound();
            }

            var incomingParticipantIds = request.ParticipantIds
                .Where(participantId => !string.IsNullOrWhiteSpace(participantId))
                .Select(participantId => participantId.Trim())
                .Where(participantId => !string.Equals(participantId, currentUserId, StringComparison.Ordinal))
                .Distinct(StringComparer.Ordinal)
                .ToList();

            if (incomingParticipantIds.Count == 0)
            {
                return BadRequest("Select at least one person to add.");
            }

            var existingParticipantIds = conversation.Participants
                .Select(participant => participant.UserId)
                .Distinct(StringComparer.Ordinal)
                .ToHashSet(StringComparer.Ordinal);

            var newParticipantIds = incomingParticipantIds
                .Where(participantId => !existingParticipantIds.Contains(participantId))
                .ToList();

            if (newParticipantIds.Count == 0)
            {
                return BadRequest("Those people are already in the group.");
            }

            var users = await _context.Users
                .AsNoTracking()
                .Where(user => newParticipantIds.Contains(user.Id))
                .Select(user => user.Id)
                .ToListAsync();

            if (users.Count != newParticipantIds.Count)
            {
                return BadRequest("One or more selected people do not exist.");
            }

            foreach (var participantId in newParticipantIds)
            {
                conversation.Participants.Add(new ConversationParticipant
                {
                    ConversationId = conversation.Id,
                    UserId = participantId
                });
            }

            await _context.SaveChangesAsync();
            await AddUsersToConversationGroupAsync(conversation.Id, newParticipantIds);

            var allParticipantIds = conversation.Participants
                .Select(participant => participant.UserId)
                .Distinct(StringComparer.Ordinal)
                .ToList();

            await NotifyConversationUpdated(conversation.Id, allParticipantIds);
            await NotifyConversationCreated(conversation.Id, newParticipantIds);
            return Ok(await BuildConversationSummary(conversation.Id, currentUserId));
        }

        [HttpDelete("{conversationId:int}/participants/{participantId}")]
        public async Task<ActionResult<ConversationSummaryDto>> RemoveParticipant(int conversationId, string participantId)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(currentUserId))
            {
                return Unauthorized();
            }

            await _conversationLifecycleService.CleanupExpiredConversationsAsync();

            var conversation = await GetManageableGroupConversation(conversationId, currentUserId);

            if (conversation is null)
            {
                return NotFound();
            }

            if (string.Equals(participantId, currentUserId, StringComparison.Ordinal))
            {
                return BadRequest("The admin cannot remove themselves from the group.");
            }

            var participant = conversation.Participants.SingleOrDefault(item => item.UserId == participantId);

            if (participant is null)
            {
                return NotFound("That person is not in the group.");
            }

            if (conversation.Participants.Count <= 2)
            {
                return BadRequest("A group needs at least two participants.");
            }

            _context.ConversationParticipants.Remove(participant);
            await _context.SaveChangesAsync();
            await RemoveUsersFromConversationGroupAsync(conversation.Id, new[] { participantId });

            var remainingParticipantIds = conversation.Participants
                .Where(item => item.UserId != participantId)
                .Select(item => item.UserId)
                .Distinct(StringComparer.Ordinal)
                .ToList();

            await NotifyConversationUpdated(conversation.Id, remainingParticipantIds);
            await NotifyConversationDeleted(conversation.Id, new[] { participantId });
            return Ok(await BuildConversationSummary(conversation.Id, currentUserId));
        }

        [HttpDelete("{conversationId:int}")]
        public async Task<IActionResult> DeleteConversation(int conversationId)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(currentUserId))
            {
                return Unauthorized();
            }

            await _conversationLifecycleService.CleanupExpiredConversationsAsync();

            var conversation = await _conversationLifecycleService.ActiveConversationsQuery()
                .Where(candidate => candidate.Id == conversationId)
                .Include(candidate => candidate.Participants)
                .SingleOrDefaultAsync();

            if (conversation is null)
            {
                return NotFound();
            }

            if (!conversation.IsGroup)
            {
                return BadRequest("Only group conversations can be deleted.");
            }

            if (!string.Equals(conversation.AdminUserId, currentUserId, StringComparison.Ordinal))
            {
                return Forbid();
            }

            var participantIds = conversation.Participants
                .Select(participant => participant.UserId)
                .Distinct(StringComparer.Ordinal)
                .ToList();

            await _conversationLifecycleService.DeleteConversationAsync(conversationId);
            await NotifyConversationDeleted(conversationId, participantIds);

            return NoContent();
        }

        private async Task<Conversation?> GetManageableGroupConversation(int conversationId, string currentUserId)
        {
            var conversation = await _conversationLifecycleService.ActiveConversationsQuery()
                .Where(candidate => candidate.Id == conversationId)
                .Include(candidate => candidate.Participants)
                .SingleOrDefaultAsync();

            if (conversation is null || !conversation.IsGroup)
            {
                return null;
            }

            if (!string.Equals(conversation.AdminUserId, currentUserId, StringComparison.Ordinal))
            {
                throw new UnauthorizedAccessException();
            }

            return conversation;
        }

        private async Task<ConversationSummaryDto> BuildConversationSummary(int conversationId, string currentUserId)
        {
            var conversation = await _conversationLifecycleService.ActiveConversationsQuery()
                .AsNoTracking()
                .Where(candidate => candidate.Id == conversationId)
                .Include(candidate => candidate.Participants)
                .ThenInclude(participant => participant.User)
                .SingleAsync();

            var lastMessageLookup = await BuildLastMessageLookup(new[] { conversationId });
            return ToSummary(conversation, currentUserId, lastMessageLookup.GetValueOrDefault(conversationId));
        }

        private async Task<Dictionary<int, Message>> BuildLastMessageLookup(IEnumerable<int> conversationIds)
        {
            var idList = conversationIds.Distinct().ToList();

            if (idList.Count == 0)
            {
                return new Dictionary<int, Message>();
            }

            var messages = await _context.Messages
                .AsNoTracking()
                .Where(message => idList.Contains(message.ConversationId))
                .OrderByDescending(message => message.SentAt)
                .ToListAsync();

            return messages
                .GroupBy(message => message.ConversationId)
                .ToDictionary(group => group.Key, group => group.First());
        }

        private static ConversationSummaryDto ToSummary(Conversation conversation, string currentUserId, Message? lastMessage)
        {
            var otherParticipants = conversation.Participants
                .Where(participant => participant.UserId != currentUserId)
                .Select(participant => participant.User.DisplayName)
                .ToList();

            var displayName = conversation.IsGroup
                ? conversation.Name ?? string.Join(", ", otherParticipants)
                : otherParticipants.FirstOrDefault() ?? "New conversation";

            return new ConversationSummaryDto
            {
                Id = conversation.Id,
                IsGroup = conversation.IsGroup,
                DisplayName = displayName,
                GroupName = conversation.Name,
                AdminUserId = conversation.AdminUserId,
                GroupImageUrl = conversation.GroupImageUrl,
                GroupRules = conversation.GroupRules,
                IsTemporary = conversation.IsTemporary,
                ExpiresAt = conversation.ExpiresAt,
                CanManage = conversation.IsGroup && string.Equals(conversation.AdminUserId, currentUserId, StringComparison.Ordinal),
                CreatedAt = conversation.CreatedAt,
                Participants = conversation.Participants
                    .Select(participant => new UserSummaryDto
                    {
                        Id = participant.User.Id,
                        Email = participant.User.Email ?? string.Empty,
                        DisplayName = participant.User.DisplayName,
                        ProfileImageUrl = participant.User.ProfileImageUrl,
                        Bio = participant.User.Bio
                    })
                    .ToList(),
                LastMessageText = lastMessage?.GetPreviewText(),
                LastMessageAt = lastMessage?.SentAt
            };
        }

        private async Task NotifyConversationCreated(int conversationId, IEnumerable<string> participantIds)
        {
            foreach (var participantId in participantIds.Distinct(StringComparer.Ordinal))
            {
                var summary = await BuildConversationSummary(conversationId, participantId);
                await _hubContext.Clients.User(participantId).SendAsync("ConversationCreated", summary);
            }
        }

        private async Task NotifyConversationUpdated(int conversationId, IEnumerable<string> participantIds)
        {
            foreach (var participantId in participantIds.Distinct(StringComparer.Ordinal))
            {
                var summary = await BuildConversationSummary(conversationId, participantId);
                await _hubContext.Clients.User(participantId).SendAsync("ConversationUpdated", summary);
            }
        }

        private Task NotifyConversationDeleted(int conversationId, IEnumerable<string> participantIds)
        {
            return _hubContext.Clients.Users(participantIds.Distinct(StringComparer.Ordinal)).SendAsync(
                "ConversationDeleted",
                new { ConversationId = conversationId });
        }

        private async Task AddUsersToConversationGroupAsync(int conversationId, IEnumerable<string> userIds)
        {
            foreach (var userId in userIds.Distinct(StringComparer.Ordinal))
            {
                foreach (var connectionId in ChatHub.GetConnectionIds(userId))
                {
                    await _hubContext.Groups.AddToGroupAsync(connectionId, conversationId.ToString());
                }
            }
        }

        private async Task RemoveUsersFromConversationGroupAsync(int conversationId, IEnumerable<string> userIds)
        {
            foreach (var userId in userIds.Distinct(StringComparer.Ordinal))
            {
                foreach (var connectionId in ChatHub.GetConnectionIds(userId))
                {
                    await _hubContext.Groups.RemoveFromGroupAsync(connectionId, conversationId.ToString());
                }
            }
        }

        private static string? NormalizeOptionalText(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            return value.Trim();
        }
    }
}


