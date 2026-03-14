using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using WhatsAppClone.API.Models;

namespace WhatsAppClone.API.Data
{
    public class AppDbContext : IdentityDbContext<ApplicationUser>
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<Conversation> Conversations { get; set; }
        public DbSet<Message> Messages { get; set; }
        public DbSet<ConversationParticipant> ConversationParticipants { get; set; }
        public DbSet<FriendRequest> FriendRequests { get; set; }
        public DbSet<WebPushSubscription> WebPushSubscriptions { get; set; }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            builder.Entity<WebPushSubscription>(entity =>
            {
                entity.HasIndex(subscription => subscription.UserId);
                entity.HasIndex(subscription => subscription.Endpoint).IsUnique();
                entity.Property(subscription => subscription.UserId).HasMaxLength(450);
                entity.Property(subscription => subscription.Endpoint).HasMaxLength(2048);
                entity.Property(subscription => subscription.P256dh).HasMaxLength(512);
                entity.Property(subscription => subscription.Auth).HasMaxLength(512);
            });
        }
    }
}
