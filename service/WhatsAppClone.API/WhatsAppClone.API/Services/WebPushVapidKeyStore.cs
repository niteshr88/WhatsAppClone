using System.Text.Json;
using WebPush;

namespace WhatsAppClone.API.Services
{
    public sealed class WebPushVapidKeyStore
    {
        private readonly Lazy<VapidKeyMaterial> _keyMaterial;

        public WebPushVapidKeyStore(IConfiguration configuration, IWebHostEnvironment environment)
        {
            _keyMaterial = new Lazy<VapidKeyMaterial>(() => LoadOrCreate(configuration, environment));
        }

        public string PublicKey => _keyMaterial.Value.PublicKey;

        public VapidDetails CreateVapidDetails()
        {
            var keyMaterial = _keyMaterial.Value;
            return new VapidDetails(keyMaterial.Subject, keyMaterial.PublicKey, keyMaterial.PrivateKey);
        }

        private static VapidKeyMaterial LoadOrCreate(IConfiguration configuration, IWebHostEnvironment environment)
        {
            var subject = configuration["WebPush:Subject"] ?? "mailto:notifications@pulsechat.local";
            var configuredPublicKey = configuration["WebPush:PublicKey"];
            var configuredPrivateKey = configuration["WebPush:PrivateKey"];

            if (!string.IsNullOrWhiteSpace(configuredPublicKey) && !string.IsNullOrWhiteSpace(configuredPrivateKey))
            {
                return new VapidKeyMaterial(subject, configuredPublicKey, configuredPrivateKey);
            }

            var appDataDirectory = Path.Combine(environment.ContentRootPath, "App_Data");
            Directory.CreateDirectory(appDataDirectory);

            var vapidFilePath = Path.Combine(appDataDirectory, "webpush-vapid.json");

            if (File.Exists(vapidFilePath))
            {
                var existing = JsonSerializer.Deserialize<VapidKeyMaterial>(File.ReadAllText(vapidFilePath));

                if (existing is not null &&
                    !string.IsNullOrWhiteSpace(existing.PublicKey) &&
                    !string.IsNullOrWhiteSpace(existing.PrivateKey))
                {
                    return string.IsNullOrWhiteSpace(existing.Subject)
                        ? existing with { Subject = subject }
                        : existing;
                }
            }

            var generatedKeys = VapidHelper.GenerateVapidKeys();
            var created = new VapidKeyMaterial(subject, generatedKeys.PublicKey, generatedKeys.PrivateKey);
            File.WriteAllText(vapidFilePath, JsonSerializer.Serialize(created, new JsonSerializerOptions { WriteIndented = true }));
            return created;
        }

        private sealed record VapidKeyMaterial(string Subject, string PublicKey, string PrivateKey);
    }
}
