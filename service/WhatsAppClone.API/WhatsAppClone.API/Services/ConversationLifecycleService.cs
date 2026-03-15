using Microsoft.EntityFrameworkCore;
using WhatsAppClone.API.Data;
using WhatsAppClone.API.Models;

namespace WhatsAppClone.API.Services
{
    public class ConversationLifecycleService
    {
        private readonly AppDbContext _context;

        public ConversationLifecycleService(AppDbContext context)
        {
            _context = context;
        }

        public IQueryable<Conversation> ActiveConversationsQuery()
        {
            var now = DateTime.UtcNow;
            return _context.Conversations.Where(conversation =>
                !conversation.IsGroup ||
                !conversation.IsTemporary ||
                conversation.ExpiresAt == null ||
                conversation.ExpiresAt > now);
        }

        public async Task CleanupExpiredConversationsAsync()
        {
            var now = DateTime.UtcNow;
            var expiredIds = await _context.Conversations
                .Where(conversation => conversation.IsGroup && conversation.IsTemporary && conversation.ExpiresAt != null && conversation.ExpiresAt <= now)
                .Select(conversation => conversation.Id)
                .ToListAsync();

            if (expiredIds.Count == 0)
            {
                return;
            }

            await DeleteConversationsAsync(expiredIds);
        }

        public async Task<bool> IsConversationAccessibleAsync(int conversationId, string userId)
        {
            await CleanupExpiredConversationsAsync();

            return await ActiveConversationsQuery()
                .Where(conversation => conversation.Id == conversationId)
                .AnyAsync(conversation => conversation.Participants.Any(participant => participant.UserId == userId));
        }

        public async Task<bool> IsConversationActiveAsync(int conversationId)
        {
            await CleanupExpiredConversationsAsync();
            return await ActiveConversationsQuery().AnyAsync(conversation => conversation.Id == conversationId);
        }

        public async Task DeleteConversationAsync(int conversationId)
        {
            await DeleteConversationsAsync(new[] { conversationId });
        }

        private async Task DeleteConversationsAsync(IEnumerable<int> conversationIds)
        {
            var idList = conversationIds.Distinct().ToList();

            if (idList.Count == 0)
            {
                return;
            }

            var messages = await _context.Messages
                .Where(message => idList.Contains(message.ConversationId))
                .ToListAsync();

            if (messages.Count > 0)
            {
                _context.Messages.RemoveRange(messages);
            }

            var participants = await _context.ConversationParticipants
                .Where(participant => idList.Contains(participant.ConversationId))
                .ToListAsync();

            if (participants.Count > 0)
            {
                _context.ConversationParticipants.RemoveRange(participants);
            }

            var conversations = await _context.Conversations
                .Where(conversation => idList.Contains(conversation.Id))
                .ToListAsync();

            if (conversations.Count > 0)
            {
                _context.Conversations.RemoveRange(conversations);
            }

            if (_context.ChangeTracker.HasChanges())
            {
                await _context.SaveChangesAsync();
            }
        }
    }
}
