using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using WhatsAppClone.API.Data;
using WhatsAppClone.API.Hubs;
using WhatsAppClone.API.Models;
using WhatsAppClone.API.Services;

namespace WhatsAppClone.API
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);
            var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key is missing.");

            builder.Services
                .AddControllers()
                .AddJsonOptions(options =>
                {
                    options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
                });
            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen();
            builder.Services.AddSignalR();

            builder.Services.AddCors(options =>
            {
                options.AddPolicy("Frontend", policy =>
                {
                    policy.WithOrigins(
                            "https://sandesaapp-c6dtdgcvfcezgca3.westus2-01.azurewebsites.net",
                            "http://localhost:5173"
                        )
                        .AllowAnyHeader()
                        .AllowAnyMethod()
                        .AllowCredentials();
                });
            });

            builder.Services.AddDbContext<AppDbContext>(options =>
                options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

            builder.Services.AddIdentity<ApplicationUser, IdentityRole>()
                .AddEntityFrameworkStores<AppDbContext>()
                .AddDefaultTokenProviders();

            builder.Services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            })
                .AddJwtBearer(options =>
                {
                    var key = Encoding.UTF8.GetBytes(jwtKey);

                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = false,
                        ValidateAudience = false,
                        ValidateLifetime = true,
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = new SymmetricSecurityKey(key)
                    };

                    options.Events = new JwtBearerEvents
                    {
                        OnMessageReceived = context =>
                        {
                            var accessToken = context.Request.Query["access_token"];
                            var path = context.HttpContext.Request.Path;

                            if (!string.IsNullOrEmpty(accessToken) &&
                                path.StartsWithSegments("/chatHub"))
                            {
                                context.Token = accessToken;
                            }

                            return Task.CompletedTask;
                        }
                    };
                });

            builder.Services.AddScoped<JwtService>();
            builder.Services.AddScoped<ConversationLifecycleService>();
            builder.Services.AddSingleton<WebPushVapidKeyStore>();
            builder.Services.AddScoped<WebPushNotificationService>();

            var app = builder.Build();
            var webRootPath = app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot");
            var chatMediaPath = Path.Combine(webRootPath, "uploads", "chat-media");
            Directory.CreateDirectory(chatMediaPath);

            using (var scope = app.Services.CreateScope())
            {
                var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                if (dbContext.Database.IsSqlServer())
                {
                    dbContext.Database.ExecuteSqlRaw(
                        """
                        IF OBJECT_ID(N'[dbo].[Conversations]', 'U') IS NOT NULL
                         BEGIN
                             IF COL_LENGTH('Conversations', 'Name') IS NULL
                                 ALTER TABLE [dbo].[Conversations] ADD [Name] nvarchar(200) NULL;

                             IF COL_LENGTH('Conversations', 'GroupImageUrl') IS NULL
                                 ALTER TABLE [dbo].[Conversations] ADD [GroupImageUrl] nvarchar(max) NULL;

                             IF COL_LENGTH('Conversations', 'GroupRules') IS NULL
                                 ALTER TABLE [dbo].[Conversations] ADD [GroupRules] nvarchar(max) NULL;

                             IF COL_LENGTH('Conversations', 'AdminUserId') IS NULL
                                 ALTER TABLE [dbo].[Conversations] ADD [AdminUserId] nvarchar(450) NULL;

                            IF COL_LENGTH('Conversations', 'IsTemporary') IS NULL
                                ALTER TABLE [dbo].[Conversations] ADD [IsTemporary] bit NOT NULL CONSTRAINT [DF_Conversations_IsTemporary] DEFAULT(0);

                            IF COL_LENGTH('Conversations', 'ExpiresAt') IS NULL
                                ALTER TABLE [dbo].[Conversations] ADD [ExpiresAt] datetime2 NULL;
                        END

                        IF OBJECT_ID(N'[dbo].[Messages]', 'U') IS NOT NULL
                        BEGIN
                            IF COL_LENGTH('Messages', 'DeliveredAt') IS NULL
                                ALTER TABLE [dbo].[Messages] ADD [DeliveredAt] datetime2 NULL;

                            IF COL_LENGTH('Messages', 'ReadAt') IS NULL
                                ALTER TABLE [dbo].[Messages] ADD [ReadAt] datetime2 NULL;

                            IF COL_LENGTH('Messages', 'EditedAt') IS NULL
                                ALTER TABLE [dbo].[Messages] ADD [EditedAt] datetime2 NULL;

                            IF COL_LENGTH('Messages', 'DeletedAt') IS NULL
                                ALTER TABLE [dbo].[Messages] ADD [DeletedAt] datetime2 NULL;

                            IF COL_LENGTH('Messages', 'ClientMessageId') IS NULL
                                ALTER TABLE [dbo].[Messages] ADD [ClientMessageId] nvarchar(100) NULL;

                            IF COL_LENGTH('Messages', 'MediaUrl') IS NULL
                                ALTER TABLE [dbo].[Messages] ADD [MediaUrl] nvarchar(max) NULL;

                            IF COL_LENGTH('Messages', 'MediaContentType') IS NULL
                                ALTER TABLE [dbo].[Messages] ADD [MediaContentType] nvarchar(255) NULL;

                            IF COL_LENGTH('Messages', 'MediaFileName') IS NULL
                                ALTER TABLE [dbo].[Messages] ADD [MediaFileName] nvarchar(260) NULL;

                            IF COL_LENGTH('Messages', 'MediaFileSize') IS NULL
                                ALTER TABLE [dbo].[Messages] ADD [MediaFileSize] bigint NULL;
                        END

                        IF OBJECT_ID(N'[dbo].[AspNetUsers]', 'U') IS NOT NULL
                        BEGIN
                            IF COL_LENGTH('AspNetUsers', 'Bio') IS NULL
                                ALTER TABLE [dbo].[AspNetUsers] ADD [Bio] nvarchar(max) NULL;
                        END

                        IF OBJECT_ID(N'[dbo].[FriendRequests]', 'U') IS NULL
                        BEGIN
                            CREATE TABLE [dbo].[FriendRequests]
                            (
                                [Id] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                                [RequesterId] nvarchar(450) NOT NULL,
                                [RecipientId] nvarchar(450) NOT NULL,
                                [Status] int NOT NULL,
                                [CreatedAt] datetime2 NOT NULL,
                                [RespondedAt] datetime2 NULL
                            );

                            CREATE INDEX [IX_FriendRequests_RequesterId] ON [dbo].[FriendRequests]([RequesterId]);
                            CREATE INDEX [IX_FriendRequests_RecipientId] ON [dbo].[FriendRequests]([RecipientId]);
                        END

                        IF OBJECT_ID(N'[dbo].[WebPushSubscriptions]', 'U') IS NULL
                        BEGIN
                            CREATE TABLE [dbo].[WebPushSubscriptions]
                            (
                                [Id] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                                [UserId] nvarchar(450) NOT NULL,
                                [Endpoint] nvarchar(2048) NOT NULL,
                                [P256dh] nvarchar(512) NOT NULL,
                                [Auth] nvarchar(512) NOT NULL,
                                [CreatedAt] datetime2 NOT NULL,
                                [UpdatedAt] datetime2 NOT NULL
                            );

                            CREATE UNIQUE INDEX [IX_WebPushSubscriptions_Endpoint] ON [dbo].[WebPushSubscriptions]([Endpoint]);
                            CREATE INDEX [IX_WebPushSubscriptions_UserId] ON [dbo].[WebPushSubscriptions]([UserId]);
                        END
                        """);
                }
            }

            app.UseSwagger();
            app.UseSwaggerUI();

            if (!app.Environment.IsDevelopment())
            {
                app.UseHttpsRedirection();
            }

            app.UseStaticFiles();
            app.UseCors("Frontend");
            app.UseAuthentication();
            app.UseAuthorization();

            app.MapControllers();
            app.MapHub<ChatHub>("/chatHub");

            app.Run();
        }
    }
}

