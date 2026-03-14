using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhatsAppClone.API.Migrations
{
    /// <inheritdoc />
    public partial class RenameEssageToMessages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameTable(
            name: "essages",
            newName: "Messages");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameTable(
        name: "Messages",
        newName: "essages");
        }
    }

}
