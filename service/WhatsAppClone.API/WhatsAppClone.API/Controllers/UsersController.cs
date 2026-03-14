using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WhatsAppClone.API.Data;
using WhatsAppClone.API.Models;

namespace WhatsAppClone.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public UsersController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<UserSummaryDto>>> GetUsers([FromQuery] string? search = null)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(currentUserId))
            {
                return Unauthorized();
            }

            var query = _context.Users
                .AsNoTracking()
                .Where(user => user.Id != currentUserId);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var searchTerm = search.Trim().ToLower();
                query = query.Where(user =>
                    user.DisplayName.ToLower().Contains(searchTerm) ||
                    (user.Email ?? string.Empty).ToLower().Contains(searchTerm));
            }

            var users = await query
                .OrderBy(user => user.DisplayName)
                .ToListAsync();

            var userIds = users.Select(user => user.Id).ToList();
            var friendshipLookup = await _context.FriendRequests
                .AsNoTracking()
                .Where(request =>
                    (request.RequesterId == currentUserId && userIds.Contains(request.RecipientId)) ||
                    (request.RecipientId == currentUserId && userIds.Contains(request.RequesterId)))
                .OrderByDescending(request => request.CreatedAt)
                .ToListAsync();

            return Ok(users
                .Select(user =>
                {
                    var friendship = friendshipLookup.FirstOrDefault(request =>
                        (request.RequesterId == currentUserId && request.RecipientId == user.Id) ||
                        (request.RecipientId == currentUserId && request.RequesterId == user.Id));

                    return new UserSummaryDto
                    {
                        Id = user.Id,
                        Email = user.Email ?? string.Empty,
                        DisplayName = user.DisplayName,
                        ProfileImageUrl = user.ProfileImageUrl,
                        Bio = user.Bio,
                        FriendshipStatus = ToFriendshipStatus(currentUserId, friendship),
                        FriendshipRequestId = friendship?.Status == FriendRequestStatus.Pending ? friendship.Id : null
                    };
                })
                .ToList());
        }

        [HttpGet("me")]
        public async Task<ActionResult<UserSummaryDto>> GetCurrentUser()
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(currentUserId))
            {
                return Unauthorized();
            }

            var user = await _context.Users
                .AsNoTracking()
                .Where(candidate => candidate.Id == currentUserId)
                .Select(candidate => new UserSummaryDto
                {
                    Id = candidate.Id,
                    Email = candidate.Email ?? string.Empty,
                    DisplayName = candidate.DisplayName,
                    ProfileImageUrl = candidate.ProfileImageUrl,
                    Bio = candidate.Bio
                })
                .SingleOrDefaultAsync();

            if (user is null)
            {
                return NotFound();
            }

            return Ok(user);
        }

        [HttpPut("me")]
        public async Task<ActionResult<UserSummaryDto>> UpdateCurrentUser(UpdateProfileRequest request)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(currentUserId))
            {
                return Unauthorized();
            }

            var user = await _context.Users.SingleOrDefaultAsync(candidate => candidate.Id == currentUserId);

            if (user is null)
            {
                return NotFound();
            }

            var displayName = request.DisplayName.Trim();

            if (string.IsNullOrWhiteSpace(displayName))
            {
                return BadRequest("Display name is required.");
            }

            user.DisplayName = displayName;
            user.ProfileImageUrl = string.IsNullOrWhiteSpace(request.ProfileImageUrl) ? null : request.ProfileImageUrl.Trim();
            user.Bio = string.IsNullOrWhiteSpace(request.Bio) ? null : request.Bio.Trim();

            await _context.SaveChangesAsync();

            return Ok(new UserSummaryDto
            {
                Id = user.Id,
                Email = user.Email ?? string.Empty,
                DisplayName = user.DisplayName,
                ProfileImageUrl = user.ProfileImageUrl,
                Bio = user.Bio
            });
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
