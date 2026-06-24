using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrackingService.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPagesToTrackingEntry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Pages",
                table: "TrackingEntries",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Pages",
                table: "TrackingEntries");
        }
    }
}
