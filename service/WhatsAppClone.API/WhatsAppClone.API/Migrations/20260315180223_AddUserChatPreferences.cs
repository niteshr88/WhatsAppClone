using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhatsAppClone.API.Migrations
{
    /// <inheritdoc />
    public partial class AddUserChatPreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ChatThemePreference",
                table: "AspNetUsers",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ChatWallpaperPreference",
                table: "AspNetUsers",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ChatThemePreference",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "ChatWallpaperPreference",
                table: "AspNetUsers");
        }
    }
}
