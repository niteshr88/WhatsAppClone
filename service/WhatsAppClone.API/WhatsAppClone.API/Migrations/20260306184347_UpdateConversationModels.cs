using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhatsAppClone.API.Migrations
{
    /// <inheritdoc />
    public partial class UpdateConversationModels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            //migrationBuilder.DropForeignKey(
            //    name: "FK_essages_Conversations_ConversationId",
            //    table: "Messages");

            //migrationBuilder.DropIndex(
            //    name: "IX_essages_ConversationId",
            //    table: "Messages");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            //migrationBuilder.CreateIndex(
            //    name: "IX_essages_ConversationId",
            //    table: "Messages",
            //    column: "ConversationId");

            //migrationBuilder.AddForeignKey(
            //    name: "FK_essages_Conversations_ConversationId",
            //    table: "Messages",
            //    column: "ConversationId",
            //    principalTable: "Conversations",
            //    principalColumn: "Id",
            //    onDelete: ReferentialAction.Cascade);
        }
    }
}
