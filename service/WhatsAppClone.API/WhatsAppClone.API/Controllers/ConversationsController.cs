using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using WhatsAppClone.API.Data;
using WhatsAppClone.API.Hubs;
using WhatsAppClone.API.Models;

namespace WhatsAppClone.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ConversationsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IHubContext<ChatHub> _hubContext;

        public ConversationsController(AppDbContext context, IHubContext<ChatHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<ConversationSummaryDto>>> GetConversations()
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(currentUserId))
            {
                return Unauthorized();
            }

            var conversations = await _context.Conversations
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

            if (participantIds.Count == 2)
            {
                var otherUserId = participantIds.Single(participantId => participantId != currentUserId);

                var existingConversationId = await _context.Conversations
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

            var conversation = new Conversation
            {
                IsGroup = participantIds.Count > 2,
                Participants = participantIds
                    .Select(participantId => new ConversationParticipant
                    {
                        UserId = participantId
                    })
                    .ToList()
            };

            _context.Conversations.Add(conversation);
            await _context.SaveChangesAsync();

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

            var isParticipant = await _context.ConversationParticipants
                .AsNoTracking()
                .AnyAsync(participant => participant.ConversationId == conversationId && participant.UserId == currentUserId);

            if (!isParticipant)
            {
                return NotFound();
            }

            return Ok(await BuildConversationSummary(conversationId, currentUserId));
        }

        private async Task<ConversationSummaryDto> BuildConversationSummary(int conversationId, string currentUserId)
        {
            var conversation = await _context.Conversations
                .AsNoTracking()
                .Where(conversation => conversation.Id == conversationId)
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

            return new ConversationSummaryDto
            {
                Id = conversation.Id,
                IsGroup = conversation.IsGroup,
                CreatedAt = conversation.CreatedAt,
                DisplayName = conversation.IsGroup
                    ? string.Join(", ", otherParticipants)
                    : otherParticipants.FirstOrDefault() ?? "New conversation",
                Participants = conversation.Participants
                    .Select(participant => new UserSummaryDto
                    {
                        Id = participant.User.Id,
                        Email = participant.User.Email ?? string.Empty,
                        DisplayName = participant.User.DisplayName,
                        ProfileImageUrl = participant.User.ProfileImageUrl
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
    }
}
