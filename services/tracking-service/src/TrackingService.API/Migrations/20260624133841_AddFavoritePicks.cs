using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrackingService.API.Migrations
{
    /// <inheritdoc />
    public partial class AddFavoritePicks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FavoritePicks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ContentType = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Position = table.Column<int>(type: "integer", nullable: false),
                    TrackingEntryId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FavoritePicks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FavoritePicks_TrackingEntries_TrackingEntryId",
                        column: x => x.TrackingEntryId,
                        principalTable: "TrackingEntries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FavoritePicks_TrackingEntryId",
                table: "FavoritePicks",
                column: "TrackingEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_FavoritePicks_UserId_ContentType_Position",
                table: "FavoritePicks",
                columns: new[] { "UserId", "ContentType", "Position" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FavoritePicks_UserId_ContentType_TrackingEntryId",
                table: "FavoritePicks",
                columns: new[] { "UserId", "ContentType", "TrackingEntryId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FavoritePicks");
        }
    }
}
