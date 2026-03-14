using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WhatsAppClone.API.Data;
using WhatsAppClone.API.Models;
using WhatsAppClone.API.Services;

namespace WhatsAppClone.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class PushSubscriptionsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly WebPushNotificationService _webPushNotificationService;

        public PushSubscriptionsController(AppDbContext context, WebPushNotificationService webPushNotificationService)
        {
            _context = context;
            _webPushNotificationService = webPushNotificationService;
        }

        [HttpGet("public-key")]
        public ActionResult<WebPushPublicKeyResponse> GetPublicKey()
        {
            return Ok(new WebPushPublicKeyResponse
            {
                PublicKey = _webPushNotificationService.GetPublicKey()
            });
        }

        [HttpPost]
        public async Task<IActionResult> UpsertSubscription(UpsertWebPushSubscriptionRequest request)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(currentUserId))
            {
                return Unauthorized();
            }

            var endpoint = request.Endpoint.Trim();
            var p256dh = request.P256dh.Trim();
            var auth = request.Auth.Trim();

            if (string.IsNullOrWhiteSpace(endpoint) || string.IsNullOrWhiteSpace(p256dh) || string.IsNullOrWhiteSpace(auth))
            {
                return BadRequest("A valid push subscription is required.");
            }

            var existing = await _context.WebPushSubscriptions
                .SingleOrDefaultAsync(subscription => subscription.Endpoint == endpoint);

            if (existing is null)
            {
                _context.WebPushSubscriptions.Add(new WebPushSubscription
                {
                    UserId = currentUserId,
                    Endpoint = endpoint,
                    P256dh = p256dh,
                    Auth = auth,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });
            }
            else
            {
                existing.UserId = currentUserId;
                existing.P256dh = p256dh;
                existing.Auth = auth;
                existing.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
