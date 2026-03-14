using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using WhatsAppClone.API.Data;
using WhatsAppClone.API.Hubs;
using WhatsAppClone.API.Models;

namespace WhatsAppClone.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class FriendshipsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IHubContext<ChatHub> _hubContext;

        public FriendshipsController(AppDbContext context, IHubContext<ChatHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }

        [HttpPost("requests")]
        public async Task<IActionResult> CreateRequest(CreateFriendRequestRequest request)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(currentUserId))
            {
                return Unauthorized();
            }

            var recipientId = request.RecipientId.Trim();

            if (string.IsNullOrWhiteSpace(recipientId) || recipientId == currentUserId)
            {
                return BadRequest("A different recipient is required.");
            }

            var recipientExists = await _context.Users.AsNoTracking().AnyAsync(user => user.Id == recipientId);

            if (!recipientExists)
            {
                return NotFound();
            }

            var existing = await FindLatestRelationshipAsync(currentUserId, recipientId);

            if (existing is not null)
            {
                if (existing.Status == FriendRequestStatus.Accepted)
                {
                    return Conflict("You are already friends.");
                }

                if (existing.Status == FriendRequestStatus.Pending)
                {
                    return existing.RequesterId == currentUserId
                        ? Conflict("Friend request already sent.")
                        : Conflict("This user has already sent you a friend request.");
                }
            }

            var friendRequest = new FriendRequest
            {
                RequesterId = currentUserId,
                RecipientId = recipientId,
                Status = FriendRequestStatus.Pending,
                CreatedAt = DateTime.UtcNow
            };

            _context.FriendRequests.Add(friendRequest);
            await _context.SaveChangesAsync();
            await NotifyFriendshipChanged(currentUserId, recipientId);

            return NoContent();
        }

        [HttpPost("requests/{requestId:int}/accept")]
        public async Task<IActionResult> AcceptRequest(int requestId)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(currentUserId))
            {
                return Unauthorized();
            }

            var friendRequest = await _context.FriendRequests.SingleOrDefaultAsync(request =>
                request.Id == requestId &&
                request.RecipientId == currentUserId &&
                request.Status == FriendRequestStatus.Pending);

            if (friendRequest is null)
            {
                return NotFound();
            }

            friendRequest.Status = FriendRequestStatus.Accepted;
            friendRequest.RespondedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            await NotifyFriendshipChanged(friendRequest.RequesterId, friendRequest.RecipientId);

            return NoContent();
        }

        [HttpPost("requests/{requestId:int}/decline")]
        public async Task<IActionResult> DeclineRequest(int requestId)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(currentUserId))
            {
                return Unauthorized();
            }

            var friendRequest = await _context.FriendRequests.SingleOrDefaultAsync(request =>
                request.Id == requestId &&
                request.RecipientId == currentUserId &&
                request.Status == FriendRequestStatus.Pending);

            if (friendRequest is null)
            {
                return NotFound();
            }

            friendRequest.Status = FriendRequestStatus.Declined;
            friendRequest.RespondedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            await NotifyFriendshipChanged(friendRequest.RequesterId, friendRequest.RecipientId);

            return NoContent();
        }

        private async Task<FriendRequest?> FindLatestRelationshipAsync(string firstUserId, string secondUserId)
        {
            return await _context.FriendRequests
                .AsNoTracking()
                .Where(request =>
                    (request.RequesterId == firstUserId && request.RecipientId == secondUserId) ||
                    (request.RequesterId == secondUserId && request.RecipientId == firstUserId))
                .OrderByDescending(request => request.CreatedAt)
                .FirstOrDefaultAsync();
        }

        private async Task NotifyFriendshipChanged(string firstUserId, string secondUserId)
        {
            var firstPayload = await BuildFriendshipUpdate(firstUserId, secondUserId);
            var secondPayload = await BuildFriendshipUpdate(secondUserId, firstUserId);

            await _hubContext.Clients.User(firstUserId).SendAsync("FriendshipChanged", firstPayload);
            await _hubContext.Clients.User(secondUserId).SendAsync("FriendshipChanged", secondPayload);
        }

        private async Task<FriendshipUpdateDto> BuildFriendshipUpdate(string currentUserId, string otherUserId)
        {
            var friendship = await FindLatestRelationshipAsync(currentUserId, otherUserId);

            return new FriendshipUpdateDto
            {
                UserId = otherUserId,
                FriendshipStatus = ToFriendshipStatus(currentUserId, friendship),
                FriendshipRequestId = friendship?.Status == FriendRequestStatus.Pending ? friendship.Id : null
            };
        }

        private static string ToFriendshipStatus(string currentUserId, FriendRequest? friendship)
        {
            if (friendship is null)
            {
                return "none";
            }

            if (friendship.Status == FriendRequestStatus.Accepted)
            {
                return "friends";
            }

            if (friendship.Status == FriendRequestStatus.Pending)
            {
                return friendship.RequesterId == currentUserId ? "outgoing" : "incoming";
            }

            return "none";
        }
    }
}
